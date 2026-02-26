import { useMemo } from "react";

interface FBRQRCodeProps {
  data: string;
  size?: number;
}

export function FBRQRCode({ data, size = 140 }: FBRQRCodeProps) {
  const grid = useMemo(() => {
    // Generate a deterministic grid pattern from the data string
    const cells: boolean[][] = [];
    const gridSize = 21;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }
    for (let r = 0; r < gridSize; r++) {
      cells[r] = [];
      for (let c = 0; c < gridSize; c++) {
        // Finder patterns (top-left, top-right, bottom-left corners)
        const isFinderTL = r < 7 && c < 7;
        const isFinderTR = r < 7 && c >= gridSize - 7;
        const isFinderBL = r >= gridSize - 7 && c < 7;
        if (isFinderTL || isFinderTR || isFinderBL) {
          const lr = isFinderTL ? r : isFinderBL ? r - (gridSize - 7) : r;
          const lc = isFinderTL || isFinderBL ? c : c - (gridSize - 7);
          cells[r][c] =
            lr === 0 || lr === 6 || lc === 0 || lc === 6 ||
            (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
        } else {
          // Pseudo-random fill based on hash
          const seed = (hash * (r * gridSize + c + 1)) >>> 0;
          cells[r][c] = seed % 3 !== 0;
        }
      }
    }
    return cells;
  }, [data]);

  const cellSize = size / 21;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg">
      <rect width={size} height={size} fill="white" />
      {grid.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="hsl(var(--foreground))"
              rx={0.5}
            />
          ) : null
        )
      )}
    </svg>
  );
}
