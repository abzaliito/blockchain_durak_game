// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 1. Durak Chips (DRC) Валюта для ставок
contract DurakChips is ERC20, Ownable {
    uint256 public constant RATE = 1000; // 1 ETH = 1000 Chips

    constructor() ERC20("Durak Chips", "DRC") Ownable(msg.sender) {}

    // Функция покупки: игрок отправляет ETH и получает фишки
    function buyChips() public payable {
        require(msg.value > 0, "Send ETH to buy chips");
        uint256 amount = msg.value * RATE;
        _mint(msg.sender, amount);
    }

    // Вывод ETH владельцу контракта
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}

// 2. Durak XP (DXP) Опыт за участие 
contract DurakXP is ERC20, Ownable {
    constructor() ERC20("Durak Experience", "DXP") Ownable(msg.sender) {}

    // Автоматический минтинг: вызывается только контрактом Лобби
    function mintReward(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}