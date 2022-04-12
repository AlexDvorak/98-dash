"use strict";

class Networktable {
    constructor(host) {
        this.socket = undefined;
        this.robotAddress = null;
        this.robotConnected = false;
        this.socketOpen = false;
        this.connectionListeners = new Set();
        this.robotConnectionListeners = new Set();
        this.globalListeners = new Set();
        this.keyListeners = new Map();
        this.ntCache = new Map();
        if (host == undefined) host = window.location.host;
        this.createSocket(host);
    }

    createSocket(host) {
        const address = `ws://${host}/networktables/ws`;

        this.socket = new WebSocket(address);
        if (this.socket) {
            this.socket.binaryType = "arraybuffer";
            this.socket.onopen = () => this.onConnect(this);
            this.socket.onclose = () => this.onDisconnect(this);
            this.socket.onmessage = (msg) => this.onMessage(this, msg);
        }
    }

    onConnect(table) {
        console.info("Socket opened");
        table.socketOpen = true;
        table.connectionListeners.forEach((f) => f(true));
    }

    onMessage(table, msg) {
        const data = CBOR.decode(msg.data);

        // robot connection event
        if (data.r !== undefined) {
            table.robotConnected = data.r;
            table.robotAddress = data.a;
            // this.robotConnectionListeners.forEach((f) => f(robotConnected));
        } else {
            // data changed on websocket
            const key = data["k"];
            const value = data["v"];
            const isNew = data["n"];

            table.ntCache.set(key, value);

            // notify global listeners
            table.globalListeners.forEach((f) => f(key, value, isNew));

            // notify key-specific listeners
            const listeners = table.keyListeners.get(key);
            if (listeners !== undefined) {
                listeners.forEach((f) => f(key, value, isNew));
            }
        }
    }

    onDisconnect(table) {
        if (table.socketOpen) {
            table.connectionListeners.forEach((f) => f(false));

            table.robotConnectionListeners.forEach((f) => f(false));

            // clear ntCache, it's no longer valid
            table.ntCache = new Map();

            table.socketOpen = false;
            table.robotConnected = false;
            table.robotAddress = null;
            console.info("Socket closed");
        }

        // respawn the websocket
        setTimeout(() => table.createSocket(window.location.host), 300);
    }

    addGlobalListener(callback, notifyImmediately) {
        this.globalListeners.add(callback);

        if (notifyImmediately === true) {
            this.ntCache.forEach((value, key) => callback(key, value, true));
        }

        return function unsubscribe() {
            this.globalListeners.delete(callback);
        };
    }

    addKeyListener(key, callback, notifyImmediately) {
        const listeners = this.keyListeners.get(key);

        if (listeners === undefined) {
            this.keyListeners.set(key, new Set([callback]));
        } else {
            listeners.add(callback);
        }

        if (notifyImmediately === true) {
            const value = ntCache.get(key);
            if (v !== undefined) {
                callback(key, value, true);
            }
        }

        return () => this.keyListeners.get(key).delete(callback);
    }

    addRobotConnectionListener(callback, notifyImmediately) {
        this.robotConnectionListeners.add(callback);

        if (notifyImmediately === true) {
            callback(this.robotConnected);
        }

        return () => this.robotConnectionListeners.delete(callback);
    }

    addWsConnectionListener(callback, notifyImmediately) {
        // this.connectionListeners.add(callback);

        if (notifyImmediately === true) callback(this.socketOpen);

        // return () => this.connectionListeners.delete(callback);
    }

    putValue(key, value) {
        if (!this.socketOpen) return false;

        if (value === undefined)
            throw new Error(key + ": 'undefined' passed to putValue");

        this.socket.send(CBOR.encode({ k: key, v: value }));
        return true;
    }

    getValue(key, defaultValue) {
        const val = this.ntCache.get(key);
        if (val === undefined) return defaultValue;
        else return val;
    }

    keySelector(str) {
        return encodeURIComponent(str).replace(
            /([;&,.+*~':"!^#$%@\[\]()=>|])/g,
            "\\$1"
        );
    }

    create_map() {
        return new Map();
    }

    keyToId(key) {
        return encodeURIComponent(key);
    }
}

$(function checkWSAvailable() {
    if (!("WebSocket" in window)) {
        alert("Your browser does not support websockets, this will fail!");
        return;
    }
});

$(function createDataProcessor() {
    "use strict";
    const POW_2_24 = 5.960464477539063e-8,
        POW_2_32 = 4294967296,
        POW_2_53 = 9007199254740992;

    function encode(value) {
        let data = new ArrayBuffer(256);
        let dataView = new DataView(data);
        let lastLength;
        let offset = 0;

        function prepareWrite(length) {
            let newByteLength = data.byteLength;
            const requiredLength = offset + length;
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

        function writeFloat64(value) {
            commitWrite(prepareWrite(8).setFloat64(offset, value));
        }

        function writeUint8(value) {
            commitWrite(prepareWrite(1).setUint8(offset, value));
        }

        function writeUint8Array(value) {
            const dataView = prepareWrite(value.length);
            for (let i = 0; i < value.length; ++i)
                dataView.setUint8(offset + i, value[i]);
            commitWrite();
        }

        function writeUint16(value) {
            commitWrite(prepareWrite(2).setUint16(offset, value));
        }

        function writeUint32(value) {
            commitWrite(prepareWrite(4).setUint32(offset, value));
        }

        function writeUint64(value) {
            const low = value % POW_2_32;
            const high = (value - low) / POW_2_32;
            const dataView = prepareWrite(8);
            dataView.setUint32(offset, high);
            dataView.setUint32(offset + 4, low);
            commitWrite();
        }

        function writeTypeAndLength(type, length) {
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

        function encodeItem(value) {
            let i;

            if (value === false) return writeUint8(0xf4);
            if (value === true) return writeUint8(0xf5);
            if (value === null) return writeUint8(0xf6);
            if (value === undefined) return writeUint8(0xf7);

            switch (typeof value) {
                case "number":
                    if (Math.floor(value) === value) {
                        if (0 <= value && value <= POW_2_53)
                            return writeTypeAndLength(0, value);
                        if (-POW_2_53 <= value && value < 0)
                            return writeTypeAndLength(1, -(value + 1));
                    }
                    writeUint8(0xfb);
                    return writeFloat64(value);

                case "string":
                    const utf8data = [];
                    for (i = 0; i < value.length; ++i) {
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

                    writeTypeAndLength(3, utf8data.length);
                    return writeUint8Array(utf8data);

                default:
                    let length;
                    if (Array.isArray(value)) {
                        length = value.length;
                        writeTypeAndLength(4, length);
                        for (i = 0; i < length; ++i) encodeItem(value[i]);
                    } else if (value instanceof Uint8Array) {
                        writeTypeAndLength(2, value.length);
                        writeUint8Array(value);
                    } else {
                        const keys = Object.keys(value);
                        length = keys.length;
                        writeTypeAndLength(5, length);
                        for (i = 0; i < length; ++i) {
                            const key = keys[i];
                            encodeItem(key);
                            encodeItem(value[key]);
                        }
                    }
            }
        }

        encodeItem(value);

        if ("slice" in data) return data.slice(0, offset);

        const ret = new ArrayBuffer(offset);
        const retView = new DataView(ret);
        for (let i = 0; i < offset; ++i)
            retView.setUint8(i, dataView.getUint8(i));
        return ret;
    }

    function decode(data, tagger, simpleValue) {
        const dataView = new DataView(data);
        let offset = 0;

        if (typeof tagger !== "function")
            tagger = function (value) {
                return value;
            };
        if (typeof simpleValue !== "function")
            simpleValue = function () {
                return undefined;
            };

        function commitRead(length, value) {
            offset += length;
            return value;
        }

        function readArrayBuffer(length) {
            return commitRead(length, new Uint8Array(data, offset, length));
        }

        function readFloat16() {
            const tempArrayBuffer = new ArrayBuffer(4);
            const tempDataView = new DataView(tempArrayBuffer);
            const value = readUint16();

            const sign = value & 0x8000;
            let exponent = value & 0x7c00;
            const fraction = value & 0x03ff;

            if (exponent === 0x7c00) exponent = 0xff << 10;
            else if (exponent !== 0) exponent += (127 - 15) << 10;
            else if (fraction !== 0)
                return (sign ? -1 : 1) * fraction * POW_2_24;

            tempDataView.setUint32(
                0,
                (sign << 16) | (exponent << 13) | (fraction << 13)
            );
            return tempDataView.getFloat32(0);
        }

        function readFloat32() {
            return commitRead(4, dataView.getFloat32(offset));
        }

        function readFloat64() {
            return commitRead(8, dataView.getFloat64(offset));
        }

        function readUint8() {
            return commitRead(1, dataView.getUint8(offset));
        }

        function readUint16() {
            return commitRead(2, dataView.getUint16(offset));
        }

        function readUint32() {
            return commitRead(4, dataView.getUint32(offset));
        }

        function readUint64() {
            return readUint32() * POW_2_32 + readUint32();
        }

        function readBreak() {
            if (dataView.getUint8(offset) !== 0xff) return false;
            offset += 1;
            return true;
        }

        function readLength(additionalInformation) {
            if (additionalInformation < 24) return additionalInformation;
            if (additionalInformation === 24) return readUint8();
            if (additionalInformation === 25) return readUint16();
            if (additionalInformation === 26) return readUint32();
            if (additionalInformation === 27) return readUint64();
            if (additionalInformation === 31) return -1;
            throw "Invalid length encoding";
        }

        function readIndefiniteStringLength(majorType) {
            const initialByte = readUint8();
            if (initialByte === 0xff) return -1;
            const length = readLength(initialByte & 0x1f);
            if (length < 0 || initialByte >> 5 !== majorType)
                throw "Invalid indefinite length element";
            return length;
        }

        function appendUtf16Data(utf16data, length) {
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

        function decodeItem() {
            const initialByte = readUint8();
            const majorType = initialByte >> 5;
            const additionalInformation = initialByte & 0x1f;
            let i;
            let length;

            if (majorType === 7) {
                switch (additionalInformation) {
                    case 25:
                        return readFloat16();
                    case 26:
                        return readFloat32();
                    case 27:
                        return readFloat64();
                }
            }

            length = readLength(additionalInformation);
            if (length < 0 && (majorType < 2 || 6 < majorType))
                throw "Invalid length";

            switch (majorType) {
                case 0:
                    return length;
                case 1:
                    return -1 - length;
                case 2:
                    if (length < 0) {
                        const elements = [];
                        let fullArrayLength = 0;
                        while (
                            (length = readIndefiniteStringLength(majorType)) >=
                            0
                        ) {
                            fullArrayLength += length;
                            elements.push(readArrayBuffer(length));
                        }
                        const fullArray = new Uint8Array(fullArrayLength);
                        let fullArrayOffset = 0;
                        for (i = 0; i < elements.length; ++i) {
                            fullArray.set(elements[i], fullArrayOffset);
                            fullArrayOffset += elements[i].length;
                        }
                        return fullArray;
                    }
                    return readArrayBuffer(length);
                case 3:
                    const utf16data = [];
                    if (length < 0) {
                        while (
                            (length = readIndefiniteStringLength(majorType)) >=
                            0
                        )
                            appendUtf16Data(utf16data, length);
                    } else appendUtf16Data(utf16data, length);
                    return String.fromCharCode.apply(null, utf16data);
                case 4:
                    let retArray;
                    if (length < 0) {
                        retArray = [];
                        while (!readBreak()) retArray.push(decodeItem());
                    } else {
                        retArray = new Array(length);
                        for (i = 0; i < length; ++i) retArray[i] = decodeItem();
                    }
                    return retArray;
                case 5:
                    const retObject = {};
                    for (
                        i = 0;
                        i < length || (length < 0 && !readBreak());
                        ++i
                    ) {
                        var key = decodeItem();
                        retObject[key] = decodeItem();
                    }
                    return retObject;
                case 6:
                    return tagger(decodeItem(), length);
                case 7:
                    switch (length) {
                        case 20:
                            return false;
                        case 21:
                            return true;
                        case 22:
                            return null;
                        case 23:
                            return undefined;
                        default:
                            return simpleValue(length);
                    }
            }
        }

        const ret = decodeItem();
        if (offset !== data.byteLength) throw "Remaining bytes";
        return ret;
    }

    // noinspection JSUnusedGlobalSymbols
    window.CBOR = {
        encode: encode,
        decode: decode,
    };
});
