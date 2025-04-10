const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const webpack = require("webpack");
const dotenv = require("dotenv");

// Load environment variables from .env file, if present
dotenv.config();

module.exports = {
  entry: "./index.js",
  output: {
    filename: "bundle.js",
    uniqueName: "child-react",
    publicPath: "auto",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            cacheDirectory: true,
            presets: ["@babel/react", "@babel/env"],
          },
        },
      },
      {
        // Rule for CSS files
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "reactChild",
      filename: "remoteEntry.js",
      exposes: {
        "./web-components": "./src/index.js",
      },
      shared: ["react", "react-dom"],
    }),
    new HtmlWebpackPlugin({
      template: "./index.html",
      filename: "index.html",
    }),
    new webpack.DefinePlugin({
      "process.env.REACT_APP_STATIC_CONTENT_PATH": JSON.stringify(process.env.REACT_APP_STATIC_CONTENT_PATH),
      "process.env.API_URL": JSON.stringify(process.env.API_URL),
      "process.env.REACT_APP_BASE_PATH": JSON.stringify(process.env.REACT_APP_BASE_PATH),
      "process.env.NODE_DEBUG": JSON.stringify(process.env.NODE_DEBUG),
    }),
  ],
  resolve: {
    // Module resolution setup
    modules: [path.resolve(__dirname, "src"), "node_modules"],
    extensions: [".js", ".jsx"],
  },
};
