import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import WalletModal, { type WalletId } from "../components/WalletModal";

export default function LoginPage() {
  const { signIn, connectWallet, isConnecting, isSigningIn, error, setError, connectedAddress } = useAuth();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  // If wallet is connected but not signed in, show SIWE step
  const showSiweStep = !user && connectedAddress && !isConnecting;

  const handleWalletConnect = (walletId: WalletId, address: string) => {
    setModalOpen(false);
    connectWallet(walletId, address);
  };

  const handleWalletError = (msg: string) => {
    setError(msg);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo">
          <span className="login-card__hex">⬡</span>
        </div>
        <h1 className="login-card__title">ChainShell</h1>
        <p className="login-card__subtitle">
          Blockchain terminal interface. Connect your wallet to get started.
        </p>

        <div className="login-card__steps">
          <div className={`login-step${!connectedAddress ? " login-step--active" : ""}`}>
            <span className="login-step__num">1</span>
            <span className="login-step__label">Connect Wallet</span>
          </div>
          <div className="login-step__line" />
          <div className={`login-step${showSiweStep ? " login-step--active" : ""}`}>
            <span className="login-step__num">2</span>
            <span className="login-step__label">Sign In</span>
          </div>
          <div className="login-step__line" />
          <div className="login-step">
            <span className="login-step__num">3</span>
            <span className="login-step__label">Dashboard</span>
          </div>
        </div>

        {error && (
          <div className="login-card__error">
            <span className="login-card__error-icon">!</span>
            {error}
          </div>
        )}

        {showSiweStep && connectedAddress && (
          <div className="login-card__connected">
            <div className="login-card__connected-addr">
              {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
            </div>
            <span className="login-card__connected-badge">Connected</span>
          </div>
        )}

        <div className="login-card__actions">
          {!showSiweStep ? (
            <button
              className="login-card__btn login-card__btn--primary"
              onClick={() => setModalOpen(true)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="login-card__spinner" />
              ) : (
                <>
                  <span className="login-card__btn-icon">◇</span>
                  Connect Wallet
                </>
              )}
            </button>
          ) : (
            <button
              className="login-card__btn login-card__btn--primary"
              onClick={signIn}
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <span className="login-card__spinner" />
              ) : (
                <>
                  <span className="login-card__btn-icon">✎</span>
                  Sign-In with Ethereum
                </>
              )}
            </button>
          )}
        </div>

        <div className="login-card__footer">
          <p>Supports MetaMask, Coinbase Wallet, WalletConnect, and more.</p>
        </div>
      </div>

      <WalletModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={handleWalletConnect}
        onError={handleWalletError}
      />
    </div>
  );
}
