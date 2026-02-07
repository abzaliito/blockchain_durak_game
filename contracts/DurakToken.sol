// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 1. ТОКЕН-ВАЛЮТА (Для ставок)
contract DurakChips is ERC20, Ownable {
    uint256 public constant CHIPS_PER_ETH = 1000;

    constructor() ERC20("Durak Chips", "DRC") Ownable(msg.sender) {}

    // Покупка фишек за ETH
    function buyChips() public payable {
        require(msg.value > 0, "Send ETH to buy chips");
        uint256 amount = msg.value * CHIPS_PER_ETH;
        _mint(msg.sender, amount);
    }

    // Вывод ETH владельцу проекта
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}

// 2. ТОКЕН-ОПЫТ хп
contract DurakXP is ERC20, Ownable {
    constructor() ERC20("Durak Experience", "DXP") Ownable(msg.sender) {}

    // Автоматический минтинг (Вызывает только контракт игры)
    function mintReward(address player, uint256 amount) public onlyOwner {
        _mint(player, amount);
    }
}