interface StatusBarProps {
  activeChain: string;
  blockNumber: number;
  peerCount: number;
  latency: number;
}

export default function StatusBar({
  activeChain,
  blockNumber,
  peerCount,
  latency,
}: StatusBarProps) {
  return (
    <div className="statusbar">
      <div className="statusbar__left">
        <span className="statusbar__item">
          <span className="statusbar__dot statusbar__dot--green" />
          {activeChain}
        </span>
        <span className="statusbar__item statusbar__item--muted">
          Block #{blockNumber.toLocaleString()}
        </span>
      </div>
      <div className="statusbar__right">
        <span className="statusbar__item statusbar__item--muted">
          {peerCount} peers
        </span>
        <span className="statusbar__item statusbar__item--muted">
          {latency}ms
        </span>
        <span className="statusbar__item">
          <span className="statusbar__dot statusbar__dot--green" />
          Connected
        </span>
      </div>
    </div>
  );
}
