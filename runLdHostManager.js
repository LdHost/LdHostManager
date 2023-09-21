#!/usr/bin/env node

const {LdHostManagementServer} = require("./LdHostManagerServer");
const defaultPort = "3000";
const defaultConfigPath = "./LdHost.config.json";

const [undefined, Argv0, portParam, configPathParam] = process.argv;
new LdHostManagementServer(
  portParam || process.env.PORT || defaultPort,
  configPathParam || defaultConfigPath,
).start();
