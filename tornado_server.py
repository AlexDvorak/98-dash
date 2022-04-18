#!/usr/bin/env python
"""
    This is an example server application, using the tornado handlers,
    that you can use to connect your HTML/Javascript dashboard code to
    your robot via NetworkTables.

    Run this application with python, then you can open your browser to
    http://localhost:8888/ to view the index.html page.
"""

import logging
from logging import Logger
from optparse import OptionParser
from os.path import abspath, dirname, exists, join

import tornado.web
from networktables import NetworkTables
from tornado.ioloop import IOLoop

from pynt2 import NonCachingStaticFileHandler, NetworkTablesWebSocket


def init_networktables(conn_opts):
    NetworkTables.setNetworkIdentity(conn_opts.identity)

    if conn_opts.team:
        logger.info("Connecting to NetworkTables for team %s", conn_opts.team)
        NetworkTables.startClientTeam(conn_opts.team)
    else:
        logger.info("Connecting to networktables at %s", conn_opts.robot)
        NetworkTables.initialize(server=conn_opts.robot)

    if conn_opts.dashboard:
        logger.info("Enabling driver station override mode")
        NetworkTables.startDSClient()

    logger.info("Networktables Initialized")


def read_opts():
    # Setup options here
    parser = OptionParser()

    parser.add_option(
        "-p", "--port", type=int, default=8888, help="Port to run web server on"
    )

    parser.add_option(
        "-v",
        "--verbose",
        default=False,
        action="store_true",
        help="Enable verbose logging",
    )

    parser.add_option("--robot", default="127.0.0.1", help="Robot's IP address")

    parser.add_option("--team", type=int, help="Team number of robot to connect to")

    parser.add_option(
        "--dashboard",
        default=False,
        action="store_true",
        help="Use this instead of --robot to receive the IP from the driver station. WARNING: It will not work if you are not on the same host as the DS!",
    )

    parser.add_option(
        "--identity", default="pynt2", help="Identity to send to NT server"
    )

    options, _ = parser.parse_args()

    if options.team and options.robot != "127.0.0.1":
        parser.error("--robot and --team are mutually exclusive")
        exit(1)
    else:
        return options


def get_relative_path(relative_path: str):
    this_file_path = dirname(__file__)
    joined_path = join(this_file_path, relative_path)
    return abspath(joined_path)


def run_server(logger: Logger, conn_opts):
    # Setup NetworkTables
    init_networktables(conn_opts)

    # setup tornado application with static handler + networktables support
    default_page = get_relative_path("www/main.html")
    www_dir = get_relative_path("www")
    # js_dir = get_relative_path("www/src")

    if not exists(www_dir):
        logger.error("Directory '%s' does not exist!", www_dir)
        exit(1)

    if not exists(default_page):
        logger.warn("%s not found", default_page)

    app = tornado.web.Application(
        [
            ("/networktables/ws", NetworkTablesWebSocket),
            (r"/()", NonCachingStaticFileHandler, {"path": default_page}),
            (r"/(.*)", NonCachingStaticFileHandler, {"path": www_dir}),
        ]
    )

    # Start the app
    logger.info("Listening on http://localhost:%s/", conn_opts.port)
    app.listen(conn_opts.port)
    IOLoop.current().start()


if __name__ == "__main__":
    opts = read_opts()

    # Setup logging
    log_datefmt = "%H:%M:%S"
    log_format = "%(asctime)s:%(msecs)03d %(levelname)-8s: %(name)-20s: %(message)s"

    logger = logging.getLogger("dashboard")
    logging.basicConfig(
        datefmt=log_datefmt,
        format=log_format,
        level=logging.DEBUG if opts.verbose else logging.INFO,
    )

    run_server(logger, read_opts())
