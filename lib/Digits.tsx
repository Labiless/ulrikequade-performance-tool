/**
 * Renders a time string with each digit in a fixed-width box, so clocks and
 * stopwatches don't jitter with fonts that have proportional digits.
 */
export default function Digits({ value }: { value: string }) {
  return (
    <span aria-label={value}>
      {value.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden style={{ display: "inline-block", width: "0.62em", textAlign: "center" }}>
            {ch}
          </span>
        ) : (
          <span key={i} aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
