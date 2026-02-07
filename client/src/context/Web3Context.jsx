import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import { CONTRACTS, CHAIN_ID } from '../contracts/addresses';
import { CHIPS_ABI, XP_ABI, LOBBY_ABI } from '../contracts/abis';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);
  const [chipsBalance, setChipsBalance] = useState('0');
  const [xpBalance, setXpBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const browserProvider = new BrowserProvider(window.ethereum);
          const walletSigner = await browserProvider.getSigner();
          const walletAddress = await walletSigner.getAddress();

          setProvider(browserProvider);
          setSigner(walletSigner);
          setAddress(walletAddress);

          const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, browserProvider);
          const xpContract = new Contract(CONTRACTS.XP, XP_ABI, browserProvider);

          const chips = await chipsContract.balanceOf(walletAddress);
          const xp = await xpContract.balanceOf(walletAddress);

          setChipsBalance(formatEther(chips));
          setXpBalance(formatEther(xp));
        }
      } catch (err) {
        console.error('Auto-connect error:', err);
      }
    };

    checkExistingConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          setProvider(null);
          setSigner(null);
          setAddress(null);
          setChipsBalance('0');
          setXpBalance('0');
        } else {
          checkExistingConnection();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  // Auto-claim free chips when user connects
  useEffect(() => {
    const checkAndClaim = async () => {
      if (signer && address) {
        try {
          const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, signer);
          const claimed = await chipsContract.hasClaimed(address);

          if (!claimed) {
            console.log("Claiming free chips for new user...");
            const tx = await chipsContract.claimFreeChips();
            await tx.wait();
            console.log("Free chips claimed!");
            await updateBalances();
          }
        } catch (err) {
          // Silent fail or log
          console.warn("Auto-claim check failed:", err);
        }
      }
    };

    checkAndClaim();
  }, [signer, address]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed');
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);

      const network = await browserProvider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + CHAIN_ID.toString(16),
                chainName: CHAIN_ID === 11155111 ? 'Sepolia' : (CHAIN_ID === 80002 ? 'Amoy' : 'Hardhat Local'),
                nativeCurrency: {
                  name: CHAIN_ID === 80002 ? 'MATIC' : 'ETH',
                  symbol: CHAIN_ID === 80002 ? 'MATIC' : 'ETH',
                  decimals: 18
                },
                rpcUrls: CHAIN_ID === 11155111
                  ? ['https://rpc.sepolia.org']
                  : (CHAIN_ID === 80002 ? ['https://rpc-amoy.polygon.technology/'] : ['http://127.0.0.1:8545']),
                blockExplorerUrls: CHAIN_ID === 11155111
                  ? ['https://sepolia.etherscan.io']
                  : (CHAIN_ID === 80002 ? ['https://www.oklink.com/amoy'] : null)
              }],
            });
          }
        }
      }

      const walletSigner = await browserProvider.getSigner();
      const walletAddress = await walletSigner.getAddress();

      setProvider(browserProvider);
      setSigner(walletSigner);
      setAddress(walletAddress);

      await updateBalances(browserProvider, walletAddress);

      return walletAddress;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const updateBalances = useCallback(async (prov = provider, addr = address) => {
    if (!prov || !addr) return;

    try {
      const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, prov);
      const xpContract = new Contract(CONTRACTS.XP, XP_ABI, prov);

      const chips = await chipsContract.balanceOf(addr);
      const xp = await xpContract.balanceOf(addr);

      setChipsBalance(formatEther(chips));
      setXpBalance(formatEther(xp));
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  }, [provider, address]);

  const buyChips = useCallback(async (ethAmount) => {
    if (!signer) {
      setError('Wallet not connected. Please reconnect MetaMask.');
      return false;
    }

    setError(null);

    try {
      const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, signer);
      const tx = await chipsContract.buyChips({ value: parseEther(ethAmount.toString()) });
      await tx.wait();
      await updateBalances();
      return true;
    } catch (err) {
      console.error('Buy chips error:', err);
      const message = err.reason || err.shortMessage || err.message || 'Transaction failed';
      setError(message);
      return false;
    }
  }, [signer, updateBalances]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const claimFreeChips = useCallback(async () => {
    if (!signer) {
      setError('Wallet not connected');
      return false;
    }
    setError(null);
    try {
      const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, signer);
      const tx = await chipsContract.claimFreeChips();
      await tx.wait();
      await updateBalances();
      return true;
    } catch (err) {
      console.error('Claim error:', err);
      const message = err.reason || err.shortMessage || err.message || 'Transaction failed';
      setError(message);
      return false;
    }
  }, [signer, updateBalances]);

  const approveChips = useCallback(async (amount) => {
    if (!signer) return false;

    try {
      const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, signer);
      const tx = await chipsContract.approve(CONTRACTS.LOBBY, parseEther(amount));
      await tx.wait();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [signer]);

  const createTableOnChain = useCallback(async (tableName, entryFee) => {
    if (!signer) {
      setError('Wallet not connected');
      return { success: false };
    }

    setError(null);

    try {
      const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, signer);
      const feeWei = parseEther(entryFee.toString());

      const allowance = await chipsContract.allowance(address, CONTRACTS.LOBBY);
      if (allowance < feeWei) {
        const approveTx = await chipsContract.approve(CONTRACTS.LOBBY, feeWei);
        await approveTx.wait();
      }

      const lobbyContract = new Contract(CONTRACTS.LOBBY, LOBBY_ABI, signer);
      const tx = await lobbyContract.createTable(tableName, feeWei);
      const receipt = await tx.wait();

      let blockchainTableId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = lobbyContract.interface.parseLog(log);
          if (parsed && parsed.name === 'TableCreated') {
            blockchainTableId = Number(parsed.args.tableId);
            break;
          }
        } catch (e) { }
      }

      await updateBalances();
      return { success: true, blockchainTableId };
    } catch (err) {
      console.error('createTableOnChain error:', err);
      const message = err.reason || err.shortMessage || err.message || 'Transaction failed';
      setError(message);
      return { success: false };
    }
  }, [signer, address, updateBalances]);

  const joinTableOnChain = useCallback(async (blockchainTableId, entryFee) => {
    if (!signer) {
      setError('Wallet not connected');
      return false;
    }

    setError(null);

    try {
      const chipsContract = new Contract(CONTRACTS.CHIPS, CHIPS_ABI, signer);
      const feeWei = parseEther(entryFee.toString());

      const allowance = await chipsContract.allowance(address, CONTRACTS.LOBBY);
      if (allowance < feeWei) {
        const approveTx = await chipsContract.approve(CONTRACTS.LOBBY, feeWei);
        await approveTx.wait();
      }

      const lobbyContract = new Contract(CONTRACTS.LOBBY, LOBBY_ABI, signer);
      const tx = await lobbyContract.joinTable(blockchainTableId);
      await tx.wait();

      await updateBalances();
      return true;
    } catch (err) {
      console.error('joinTableOnChain error:', err);
      const message = err.reason || err.shortMessage || err.message || 'Transaction failed';
      setError(message);
      return false;
    }
  }, [signer, address, updateBalances]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChipsBalance('0');
    setXpBalance('0');
  }, []);

  const value = {
    provider,
    signer,
    address,
    chipsBalance,
    xpBalance,
    isConnecting,
    error,
    connectWallet,
    disconnect,
    buyChips,
    approveChips,
    createTableOnChain,
    joinTableOnChain,
    updateBalances,
    clearError,
    claimFreeChips,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
}
