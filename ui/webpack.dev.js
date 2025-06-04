const path = require("path");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "development",
  devtool: "source-map",
  devServer: {
    historyApiFallback: true,
static: [
  {
    directory: path.join(__dirname, "public"),
    publicPath: '/public',
  },
  {
    directory: path.join(__dirname, "../data"),
    publicPath: '/data',
  },
],
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    compress: true,
    port: 4204,
    host: "0.0.0.0", // To allow access from any IP
    client: {
      overlay: false,
    },
  },
});
