const webpack = require("webpack");
const path = require("path");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const { watchFile } = require("fs");

if (!process.env.REACT_APP_BASE_PATH) {
  process.env.REACT_APP_BASE_PATH = "/";
}

// Make sure process.env.REACT_APP_BASE_PATH starts with '/' if it is not empty
if (process.env.REACT_APP_BASE_PATH && !process.env.REACT_APP_BASE_PATH.startsWith("/")) {
  process.env.REACT_APP_BASE_PATH = `/${process.env.REACT_APP_BASE_PATH}`;
}
// Make sure process.env.REACT_APP_BASE_PATH does not end with '/' if it is not empty
if (process.env.REACT_APP_BASE_PATH && process.env.REACT_APP_BASE_PATH.endsWith("/")) {
  process.env.REACT_APP_BASE_PATH = process.env.REACT_APP_BASE_PATH.slice(0, -1);
}

if (!process.env.REACT_APP_STATIC_CONTENT_PATH) {
  process.env.REACT_APP_STATIC_CONTENT_PATH = process.env.REACT_APP_STATIC_CONTENT_PATH || "http://localhost:4204";
}

module.exports = merge(common, {
  mode: "production",
  output: {
    filename: "bundle.[contenthash].js",
    publicPath: `${process.env.REACT_APP_STATIC_CONTENT_PATH}/`,
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  },
  devServer: {
    hot: false,
    liveReload: false,
    watchFiles: [],
    webSocketServer : false,
static: {
  directory: [path.join(__dirname, "public"), path.join(__dirname, "../data")],
  publicPath: [`${process.env.REACT_APP_BASE_PATH}/public`, `${process.env.REACT_APP_BASE_PATH}/data`, `${process.env.REACT_APP_BASE_PATH}/`],
},
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    allowedHosts: "all", // TODO - Restrict to proper domain
    compress: true,
    port: 8083,
    host: "0.0.0.0", // To allow access from any IP
    client: {
      overlay: false,
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.REACT_APP_STATIC_CONTENT_PATH": JSON.stringify(process.env.REACT_APP_STATIC_CONTENT_PATH),
      "process.env.REACT_APP_API_URL": JSON.stringify(process.env.REACT_APP_API_URL),
      "process.env.REACT_APP_BASE_PATH": JSON.stringify(process.env.REACT_APP_BASE_PATH),
    }),
  ],
});
