const POW_2_24 = 5.960464477539063e-8,
    POW_2_32 = 4294967296,
    POW_2_53 = 9007199254740992;

export function encode(value: any) {
    let data = new ArrayBuffer(256);
    let dataView = new DataView(data);
    let lastLength: number;
    let offset = 0;

    function prepareWrite(length: number): DataView {
        const requiredLength = offset + length;
        let newByteLength = data.byteLength;
        while (newByteLength < requiredLength) newByteLength <<= 1;
        if (newByteLength !== data.byteLength) {
            const oldDataView = dataView;
            data = new ArrayBuffer(newByteLength);
            dataView = new DataView(data);
            const uint32count = (offset + 3) >> 2;
            for (let i = 0; i < uint32count; ++i)
                dataView.setUint32(i << 2, oldDataView.getUint32(i << 2));
        }

        lastLength = length;
        return dataView;
    }

    function commitWrite() {
        offset += lastLength;
    }

    function writeFloat64(value: number) {
        prepareWrite(8).setFloat64(offset, value);
        commitWrite();
    }

    function writeUint8(value: number) {
        prepareWrite(1).setUint8(offset, value);
        commitWrite();
    }

    function writeUint8Array(value: Uint8Array) {
        const dataView = prepareWrite(value.length);
        for (let i = 0; i < value.length; ++i)
            dataView.setUint8(offset + i, value[i]);
        commitWrite();
    }

    function writeUint16(value: number) {
        prepareWrite(2).setUint16(offset, value);
        commitWrite();
    }

    function writeUint32(value: number) {
        prepareWrite(4).setUint32(offset, value);
        commitWrite();
    }

    function writeUint64(value: number) {
        const low = value % POW_2_32;
        const high = (value - low) / POW_2_32;
        const dataView = prepareWrite(8);
        dataView.setUint32(offset, high);
        dataView.setUint32(offset + 4, low);
        commitWrite();
    }

    const enum DataType {
        POS_INT = 0,
        NEG_INT = 1,
        STRING = 3,
        ARRAY = 4,
        UINT8_ARRAY = 2,
        OBJECT = 5,
    }

    function writeTypeAndLength(type: DataType, length: number) {
        if (length < 24) {
            writeUint8((type << 5) | length);
        } else if (length < 0x100) {
            writeUint8((type << 5) | 24);
            writeUint8(length);
        } else if (length < 0x10000) {
            writeUint8((type << 5) | 25);
            writeUint16(length);
        } else if (length < 0x100000000) {
            writeUint8((type << 5) | 26);
            writeUint32(length);
        } else {
            writeUint8((type << 5) | 27);
            writeUint64(length);
        }
    }

    function encodeItem(
        value: string | number | boolean | any[] | Uint8Array | object
    ) {
        if (value === false) return writeUint8(0xf4);
        if (value === true) return writeUint8(0xf5);
        if (value === null) return writeUint8(0xf6);
        if (value === undefined) return writeUint8(0xf7);

        switch (typeof value) {
            case "number":
                if (Math.floor(value) === value) {
                    if (0 <= value && value <= POW_2_53)
                        return writeTypeAndLength(DataType.POS_INT, value);
                    if (-POW_2_53 <= value && value < 0)
                        return writeTypeAndLength(
                            DataType.NEG_INT,
                            -(value + 1)
                        );
                }
                writeUint8(0xfb);
                return writeFloat64(value);

            case "string":
                const utf8data: number[] = [];
                for (let i = 0; i < value.length; ++i) {
                    let charCode = value.charCodeAt(i);
                    if (charCode < 0x80) {
                        utf8data.push(charCode);
                    } else if (charCode < 0x800) {
                        utf8data.push(0xc0 | (charCode >> 6));
                        utf8data.push(0x80 | (charCode & 0x3f));
                    } else if (charCode < 0xd800) {
                        utf8data.push(0xe0 | (charCode >> 12));
                        utf8data.push(0x80 | ((charCode >> 6) & 0x3f));
                        utf8data.push(0x80 | (charCode & 0x3f));
                    } else {
                        charCode = (charCode & 0x3ff) << 10;
                        charCode |= value.charCodeAt(++i) & 0x3ff;
                        charCode += 0x10000;

                        utf8data.push(0xf0 | (charCode >> 18));
                        utf8data.push(0x80 | ((charCode >> 12) & 0x3f));
                        utf8data.push(0x80 | ((charCode >> 6) & 0x3f));
                        utf8data.push(0x80 | (charCode & 0x3f));
                    }
                }

                writeTypeAndLength(DataType.STRING, utf8data.length);
                return writeUint8Array(new Uint8Array(utf8data));

            default: // is object of some sort
                if (Array.isArray(value)) {
                    let length = value.length;
                    writeTypeAndLength(DataType.ARRAY, length);
                    for (let i = 0; i < length; ++i) encodeItem(value[i]);
                } else if (value instanceof Uint8Array) {
                    writeTypeAndLength(DataType.UINT8_ARRAY, value.length);
                    writeUint8Array(value);
                } else {
                    const keys = Object.keys(value);
                    let length = keys.length;
                    writeTypeAndLength(DataType.OBJECT, length);
                    for (let i = 0; i < length; ++i) {
                        const key = keys[i];
                        encodeItem(key);
                        encodeItem(value[key]);
                    }
                }
        }
    }

    encodeItem(value);

    return data.slice(0, offset);

    // const ret = new ArrayBuffer(offset);
    // const retView = new DataView(ret);
    // for (let i = 0; i < offset; ++i) retView.setUint8(i, dataView.getUint8(i));
    // return ret;
}

export function decode(
    data: ArrayBuffer,
    tagger?: (value: any, len: number) => any,
    simpleValue?: (data_len?: number) => any
) {
    const dataView = new DataView(data);
    let offset = 0;

    if (typeof tagger !== "function") {
        // tagger = (v) => { return v };
        tagger = function (value) {
            return value;
        };
    }

    if (typeof simpleValue !== "function") {
        simpleValue = (_?: number) => {
            return undefined;
        };
    }

    function commitRead(length: number, value: any) {
        offset += length;
        return value;
    }

    function readArrayBuffer(length: number) {
        return commitRead(length, new Uint8Array(data, offset, length));
    }

    function readFloat16(): number {
        const tempArrayBuffer = new ArrayBuffer(4);
        const tempDataView = new DataView(tempArrayBuffer);
        const value = readUint16();

        const sign = value & 0x8000;
        let exponent = value & 0x7c00;
        const fraction = value & 0x03ff;

        if (exponent === 0x7c00) exponent = 0xff << 10;
        else if (exponent !== 0) exponent += (127 - 15) << 10;
        else if (fraction !== 0) return (sign ? -1 : 1) * fraction * POW_2_24;

        tempDataView.setUint32(
            0,
            (sign << 16) | (exponent << 13) | (fraction << 13)
        );
        return tempDataView.getFloat32(0);
    }

    function readFloat32(): number {
        return commitRead(4, dataView.getFloat32(offset));
    }

    function readFloat64(): number {
        return commitRead(8, dataView.getFloat64(offset));
    }

    function readUint8(): number {
        return commitRead(1, dataView.getUint8(offset));
    }

    function readUint16(): number {
        return commitRead(2, dataView.getUint16(offset));
    }

    function readUint32(): number {
        return commitRead(4, dataView.getUint32(offset));
    }

    function readUint64(): number {
        return readUint32() * POW_2_32 + readUint32();
    }

    function readBreak(): boolean {
        if (dataView.getUint8(offset) !== 0xff) return false;
        offset += 1;
        return true;
    }

    function readLength(extra_info: number) {
        if (extra_info < 24) return extra_info;
        if (extra_info === 24) return readUint8();
        if (extra_info === 25) return readUint16();
        if (extra_info === 26) return readUint32();
        if (extra_info === 27) return readUint64();
        if (extra_info === 31) return -1;
        throw "Invalid length encoding";
    }

    function readIndefiniteStringLength(majorType: number) {
        const initialByte = readUint8();
        if (initialByte === 0xff) return -1;
        const length = readLength(initialByte & 0x1f);
        if (length < 0 || initialByte >> 5 !== majorType)
            throw "Invalid indefinite length element";
        return length;
    }

    function appendUtf16Data(utf16data: any[], length: number): void {
        for (let i = 0; i < length; ++i) {
            let value = readUint8();
            if (value & 0x80) {
                if (value < 0xe0) {
                    value = ((value & 0x1f) << 6) | (readUint8() & 0x3f);
                    length -= 1;
                } else if (value < 0xf0) {
                    value =
                        ((value & 0x0f) << 12) |
                        ((readUint8() & 0x3f) << 6) |
                        (readUint8() & 0x3f);
                    length -= 2;
                } else {
                    value =
                        ((value & 0x0f) << 18) |
                        ((readUint8() & 0x3f) << 12) |
                        ((readUint8() & 0x3f) << 6) |
                        (readUint8() & 0x3f);
                    length -= 3;
                }
            }

            if (value < 0x10000) {
                utf16data.push(value);
            } else {
                value -= 0x10000;
                utf16data.push(0xd800 | (value >> 10));
                utf16data.push(0xdc00 | (value & 0x3ff));
            }
        }
    }

    const enum Type {
        Uint = 0,
        Int = 1,
        Utf8String = 2,
        Utf16String = 3,
        Array = 4,
        Object = 5,
        Primitive = 7,
        Type = 6,
    }

    function decodeItem() {
        const type_byte = readUint8();
        const major_type = type_byte >> 5; // can only be 0-7
        const extra_info = type_byte & 0x1f;
        let data_length: number;

        if (major_type === 7) {
            switch (extra_info) {
                case 25:
                    return readFloat16();
                case 26:
                    return readFloat32();
                case 27:
                    return readFloat64();
            }
        }

        data_length = readLength(extra_info);
        if (data_length < 0 && (major_type < 2 || 6 < major_type))
            throw "Invalid length";

        switch (major_type as Type) {
            case Type.Uint:
                return data_length;

            case Type.Int:
                return -1 - data_length;

            case Type.Utf8String:
                if (data_length < 0) {
                    const elements = [];
                    let fullArrayLength = 0;
                    while (
                        (data_length =
                            readIndefiniteStringLength(major_type)) >= 0
                    ) {
                        fullArrayLength += data_length;
                        elements.push(readArrayBuffer(data_length));
                    }
                    const fullArray = new Uint8Array(fullArrayLength);
                    let fullArrayOffset = 0;
                    for (let i = 0; i < elements.length; ++i) {
                        fullArray.set(elements[i], fullArrayOffset);
                        fullArrayOffset += elements[i].length;
                    }
                    return fullArray;
                }
                return readArrayBuffer(data_length);

            case Type.Utf16String:
                const utf16data = [];
                if (data_length < 0) {
                    while (
                        (data_length =
                            readIndefiniteStringLength(major_type)) >= 0
                    )
                        appendUtf16Data(utf16data, data_length);
                } else appendUtf16Data(utf16data, data_length);
                return String.fromCharCode.apply(null, utf16data);

            case Type.Array:
                let retArray: any[];
                if (data_length < 0) {
                    retArray = [];
                    while (!readBreak()) retArray.push(decodeItem());
                } else {
                    retArray = new Array(data_length);
                    for (let i = 0; i < data_length; ++i)
                        retArray[i] = decodeItem();
                }
                return retArray;

            case Type.Object:
                const retObject = {};
                for (
                    let i = 0;
                    i < data_length || (data_length < 0 && !readBreak());
                    ++i
                ) {
                    var key = decodeItem() as string;
                    retObject[key] = decodeItem();
                }
                return retObject;

            case Type.Type:
                return tagger(decodeItem(), data_length);

            case Type.Primitive:
                switch (data_length) {
                    case 20:
                        return false;
                    case 21:
                        return true;
                    case 22:
                        return null;
                    case 23:
                        return undefined;
                    default:
                        return simpleValue(data_length);
                }
        }
    }

    const ret = decodeItem();
    if (offset !== data.byteLength) throw "Remaining bytes";
    return ret;
}
