module.exports = {
  "/api": {
    target: "https://api.d-id.com",
    secure: false,
    changeOrigin: true,
    pathRewrite: {
      "^/api": "",
    },
  },
  "/proxy": {
    target: "http://127.0.0.1:9000",
    secure: false,
    changeOrigin: true,
    pathRewrite: {
      "^/proxy": "",
    },
  },
};
