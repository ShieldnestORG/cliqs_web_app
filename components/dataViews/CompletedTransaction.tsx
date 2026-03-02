import { useState, useCallback } from "react";
import copy from "copy-to-clipboard";
import { useChains } from "../../context/ChainsContext";
import { explorerLinkTx } from "../../lib/displayHelpers";
import Button from "../inputs/Button";
import StackableContainer from "../layout/StackableContainer";

interface CompletedTransactionProps {
  readonly transactionHash: string;
}

const CompletedTransaction = ({ transactionHash }: CompletedTransactionProps) => {
  const { chain } = useChains();
  const explorerLink = explorerLinkTx(chain.explorerLinks.tx, transactionHash);
  const [copied, setCopied] = useState(false);

  const handleCopyHash = useCallback(() => {
    copy(transactionHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [transactionHash]);

  return (
    <StackableContainer lessPadding lessMargin>
      <StackableContainer lessPadding lessMargin lessRadius>
        <div className="confirmation">
          <svg viewBox="0 0 77 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 30L26 51L72 5" stroke="white" strokeWidth="12" />
          </svg>
          <p>This transaction has been broadcast</p>
        </div>
      </StackableContainer>
      <div
        className={`hash-card ${copied ? "copied" : ""}`}
        onClick={handleCopyHash}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleCopyHash()}
      >
        <div className="hash-header">
          <label>Transaction Hash</label>
          <span className={`copied-badge ${copied ? "show" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Copied!
          </span>
        </div>
        <div className="hash-content">
          <span className="hash-text">{transactionHash}</span>
          <div className="copy-icon">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 32H41C53.1503 32 63 41.8497 63 54V94H13V32Z" />
              <path d="M37 6H65C77.1503 6 87 15.8497 87 28V68H37V6Z" />
            </svg>
          </div>
        </div>
        <span className="click-hint">Click to copy</span>
      </div>
      {explorerLink && <Button href={explorerLink} label="View in Explorer"></Button>}
      <style jsx>{`
        .confirmation {
          display: flex;
          justify-content: center;
        }
        .confirmation svg {
          height: 0.8em;
          margin-right: 0.5em;
        }
        .hash-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          margin-top: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .hash-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .hash-card:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.3);
        }
        .hash-card.copied {
          border-color: #22c55e;
          box-shadow:
            0 0 20px rgba(34, 197, 94, 0.4),
            0 0 40px rgba(34, 197, 94, 0.2),
            inset 0 0 20px rgba(34, 197, 94, 0.1);
          animation: glowPulse 1s ease-out;
        }
        @keyframes glowPulse {
          0% {
            box-shadow:
              0 0 20px rgba(34, 197, 94, 0.6),
              0 0 40px rgba(34, 197, 94, 0.4),
              inset 0 0 30px rgba(34, 197, 94, 0.2);
            border-color: #4ade80;
          }
          100% {
            box-shadow:
              0 0 20px rgba(34, 197, 94, 0.4),
              0 0 40px rgba(34, 197, 94, 0.2),
              inset 0 0 20px rgba(34, 197, 94, 0.1);
            border-color: #22c55e;
          }
        }
        .hash-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        label {
          font-size: 12px;
          font-style: italic;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }
        .copied-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #22c55e;
          opacity: 0;
          transform: translateY(-5px);
          transition: all 0.3s ease;
        }
        .copied-badge.show {
          opacity: 1;
          transform: translateY(0);
        }
        .copied-badge svg {
          width: 14px;
          height: 14px;
        }
        .hash-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hash-text {
          font-family: monospace;
          font-size: 14px;
          word-break: break-all;
          flex: 1;
          color: white;
        }
        .copy-icon {
          flex-shrink: 0;
          line-height: 0;
        }
        .copy-icon svg {
          height: 18px;
          width: 18px;
        }
        .copy-icon path {
          stroke: rgb(146, 120, 150);
          stroke-width: 10;
          transition: stroke 0.2s ease;
        }
        .hash-card:hover .copy-icon path {
          stroke: white;
        }
        .hash-card.copied .copy-icon path {
          stroke: #22c55e;
        }
        .click-hint {
          display: block;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 8px;
          transition: opacity 0.2s ease;
        }
        .hash-card.copied .click-hint {
          opacity: 0;
        }
      `}</style>
    </StackableContainer>
  );
};
export default CompletedTransaction;
