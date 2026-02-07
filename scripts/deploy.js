const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Деплоим с аккаунта:", deployer.address);

  const TokenFactory = await hre.ethers.getContractFactory("DurakChips");
  const token = await TokenFactory.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("DurakToken задеплоен по адресу:", tokenAddress);

  const LobbyFactory = await hre.ethers.getContractFactory("DurakLobby");
  
  const lobby = await LobbyFactory.deploy(tokenAddress, tokenAddress);
  await lobby.waitForDeployment();
  const lobbyAddress = await lobby.getAddress();
  console.log("DurakLobby задеплоен по адресу:", lobbyAddress);

  console.log("Передаем права на минт контракту Лобби...");
  const tx = await token.transferOwnership(lobbyAddress);
  await tx.wait();

  console.log("\nГотово! Адреса контрактов:");
  console.log("TOKEN_ADDRESS:", tokenAddress);
  console.log("LOBBY_ADDRESS:", lobbyAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});