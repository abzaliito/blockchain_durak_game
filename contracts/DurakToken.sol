// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 1. ВАЛЮТА ИГРЫ (Durak Chips - DRC)
// Игроки покупают их за ETH и ставят в игре
contract DurakChips is ERC20, Ownable {
    // Курс: 1 ETH = 1000 Фишек
    uint256 public constant RATE = 1000;

    constructor() ERC20("Durak Chips", "DRC") Ownable(msg.sender) {}

    // Функция покупки фишек
    function buyChips() public payable {
        require(msg.value > 0, "Send ETH to buy chips");
        uint256 amount = msg.value * RATE;
        _mint(msg.sender, amount);
    }

    // Вывод заработанного ETH админу
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}

// 2. ОПЫТ (Durak XP - DXP)
// Выдается автоматически за игру
contract DurakXP is ERC20, Ownable {
    constructor() ERC20("Durak Experience", "DXP") Ownable(msg.sender) {}

    function mintReward(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}