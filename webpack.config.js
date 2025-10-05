const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    background: './background.js',
    content: './content.js',
    popup: './popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].min.js'
  },
  optimization: {
    minimize: true,
    usedExports: true,
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: '88',
                  edge: '88'
                }
              }]
            ]
          }
        }
      }
    ]
  }
};
