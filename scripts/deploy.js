const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Деплоим с аккаунта:", deployer.address);

  // 1. Chips Token
  const ChipsFactory = await hre.ethers.getContractFactory("DurakChips");
  const chipsToken = await ChipsFactory.deploy();
  await chipsToken.waitForDeployment();
  const chipsAddress = await chipsToken.getAddress();
  console.log("Chips Token задеплоен:", chipsAddress);

  // 2. XP Token (Separated!)
  const XPFactory = await hre.ethers.getContractFactory("DurakXP");
  const xpToken = await XPFactory.deploy(); // Add gasLimit if needed, but usually estimation works
  await xpToken.waitForDeployment();
  const xpAddress = await xpToken.getAddress();
  console.log("XP Token задеплоен:", xpAddress);

  // 3. Lobby (with both addresses)
  const LobbyFactory = await hre.ethers.getContractFactory("DurakLobby");
  const lobby = await LobbyFactory.deploy(chipsAddress, xpAddress);
  await lobby.waitForDeployment();
  const lobbyAddress = await lobby.getAddress();
  console.log("Lobby задеплоен:", lobbyAddress);

  // 4. Transfer ownership of XP to Lobby
  console.log("Передаем права на минт XP контракту Лобби...");
  const tx = await xpToken.transferOwnership(lobbyAddress);
  await tx.wait();

  console.log("\nГотово! Адреса контрактов:");
  console.log("CHIPS_ADDRESS:", chipsAddress);
  console.log("XP_ADDRESS:", xpAddress);
  console.log("LOBBY_ADDRESS:", lobbyAddress);

  const fs = require("fs");
  fs.writeFileSync("deployed_addresses.json", JSON.stringify({
    CHIPS_ADDRESS: chipsAddress,
    XP_ADDRESS: xpAddress,
    LOBBY_ADDRESS: lobbyAddress
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});