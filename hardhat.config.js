require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Чтобы читать ключи из .env

module.exports = {
  solidity: "0.8.20", // Убедись, что версия совпадает с твоими .sol файлами
  networks: {
    // Для тестов на твоем компе
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // Пример настройки для тестовой сети (например, Amoy/Polygon)
    amoy: {
      url: process.env.RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};