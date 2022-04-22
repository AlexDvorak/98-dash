import cbor2

from typing import Any, Callable

from networktables import NetworkTables

__all__ = ["NTSerial"]


class NTSerial(object):
    """
    A utility class for synchronizing NetworkTables over a serial connection.
    """

    def __init__(self, update_callback: Callable[[bytes | str], None]):
        """
        :param update_callback: A callable with signature ```callable(update)``` for processing outgoing updates
        formatted as strings.
        """
        self.update_callback = update_callback
        self.open()

    def _disconnect(self):
        self.close()
        self._nt_connected(False, None)
        NetworkTables.shutdown()

    def _connect(self, server_addr: str):
        NetworkTables.initialize(server_addr)
        self.open()

    def process_update(self, update: bytes):
        """Process an incoming update from a remote NetworkTables"""
        data: dict[str, Any] = cbor2.loads(update)
        if "a" in data:  # new robot address, restart NT
            self._disconnect()
            self._connect(data["a"])
        else:  # just a value changed, update it for our clients
            NetworkTables.getEntry(data["k"]).setValue(data["v"])

    def _send_update(self, data: bytes | str | dict[str, Any]):
        """Send a NetworkTables update via the stored send_update callback"""
        d: bytes | str
        if isinstance(data, dict):
            d = cbor2.dumps(data)
        else:
            d = data
        self.update_callback(d)

    def _nt_on_change(self, key: str, value: Any, isNew: int):
        """NetworkTables global listener callback"""
        self._send_update({"k": key, "v": value, "n": isNew})

    # NetworkTables connection listener callbacks
    def _nt_connected(self, connected: bool, info):
        self._send_update({"r": connected, "a": NetworkTables.getRemoteAddress()})

    def open(self):
        """Add NetworkTables listeners"""
        NetworkTables.addGlobalListener(self._nt_on_change, immediateNotify=True)
        NetworkTables.addConnectionListener(self._nt_connected, immediateNotify=True)

    def close(self):
        """Clean up NetworkTables listeners"""
        NetworkTables.removeGlobalListener(self._nt_on_change)
        NetworkTables.removeConnectionListener(self._nt_connected)
