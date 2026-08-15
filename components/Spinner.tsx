interface SpinnerProps {
  readonly size?: number;
}

const Spinner = ({ size }: SpinnerProps) => (
  <>
    <div className="spinner"></div>
    <style jsx>{`
      .spinner {
        border: ${size || 2}px solid hsl(var(--accent-purple) / 0.2);
        border-top: ${size || 2}px solid hsl(var(--accent-purple));
        border-radius: 50%;
        width: ${size || 16}px;
        height: ${size || 16}px;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `}</style>
  </>
);

export default Spinner;
