import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers';
import { CONTRACTS, CHIPS_ABI, XP_ABI } from '../contracts/config';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState('');
  const [chipsBalance, setChipsBalance] = useState('0');
  const [xpBalance, setXpBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [hasClaimed, setHasClaimed] = useState(false);

  const isMetaMaskMobile = () => {
    return window.ethereum?.isMetaMask && /Mobile|Android|iPhone/i.test(navigator.userAgent);
  };

  const openMetaMaskDeepLink = () => {
    const currentUrl = window.location.href;
    const deepLink = `https://metamask.app.link/dapp/${currentUrl.replace(/^https?:\/\//, '')}`;
    window.location.href = deepLink;
  };

  const isMetaMaskAvailable = () => {
    return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
  };

  const fetchBalances = useCallback(async (signerInstance, addr) => {
    if (!signerInstance || !addr) return;
    
    try {
      if (CONTRACTS.CHIPS_ADDRESS) {
        const chipsContract = new Contract(CONTRACTS.CHIPS_ADDRESS, CHIPS_ABI, signerInstance);
        const chips = await chipsContract.balanceOf(addr);
        setChipsBalance(formatEther(chips));
        
        const claimed = await chipsContract.hasClaimed(addr);
        setHasClaimed(claimed);
      }
      
      if (CONTRACTS.XP_ADDRESS) {
        const xpContract = new Contract(CONTRACTS.XP_ADDRESS, XP_ABI, signerInstance);
        const xp = await xpContract.balanceOf(addr);
        setXpBalance(formatEther(xp));
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
      
      if (!window.ethereum) {
        if (isMobile) {
          openMetaMaskDeepLink();
          return null;
        }
        throw new Error('MetaMask not found. Please install MetaMask extension.');
      }
      
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      const browserProvider = new BrowserProvider(window.ethereum);
      const signerInstance = await browserProvider.getSigner();
      const userAddress = accounts[0];
      
      setProvider(browserProvider);
      setSigner(signerInstance);
      setAddress(userAddress);
      
      await fetchBalances(signerInstance, userAddress);
      
      return userAddress;
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchBalances]);

  const claimFreeChips = useCallback(async () => {
    if (!signer || !CONTRACTS.CHIPS_ADDRESS) {
      setError('Wallet not connected');
      return false;
    }
    
    try {
      setError('');
      const chipsContract = new Contract(CONTRACTS.CHIPS_ADDRESS, CHIPS_ABI, signer);
      
      const claimed = await chipsContract.hasClaimed(address);
      if (claimed) {
        setError('Free chips already claimed');
        setHasClaimed(true);
        return false;
      }
      
      const tx = await chipsContract.claimFreeChips();
      await tx.wait();
      
      setHasClaimed(true);
      
      await fetchBalances(signer, address);
      
      return true;
    } catch (err) {
      console.error('Claim error:', err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction rejected by user');
      } else {
        setError(err.reason || err.message || 'Failed to claim chips');
      }
      return false;
    }
  }, [signer, address, fetchBalances]);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress('');
    setChipsBalance('0');
    setXpBalance('0');
    setHasClaimed(false);
    setError('');
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError('');
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== address) {
        setAddress(accounts[0]);
        if (signer) {
          await fetchBalances(signer, accounts[0]);
        }
      }
    };
    
    const handleChainChanged = () => {
      window.location.reload();
    };
    
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [address, signer, fetchBalances, disconnectWallet]);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            await connectWallet();
          }
        } catch (err) {
          console.error('Auto-connect error:', err);
        }
      }
    };
    
    checkConnection();
  }, []);

  const value = {
    provider,
    signer,
    address,
    chipsBalance,
    xpBalance,
    isConnecting,
    error,
    hasClaimed,
    isConnected: !!address,
    connectWallet,
    disconnectWallet,
    claimFreeChips,
    fetchBalances: () => fetchBalances(signer, address),
    clearError,
    isMetaMaskAvailable: isMetaMaskAvailable(),
    isMetaMaskMobile: isMetaMaskMobile(),
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
