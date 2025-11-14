import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Trophy, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface WheelSegment {
  id: string;
  label: string;
  color: string;
}

interface SpinWheelProps {
  segments: WheelSegment[];
  onSpin?: (winner: WheelSegment) => void;
}

export function SpinWheel({ segments, onSpin }: SpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<WheelSegment | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spinDuration = 5000; // 5 seconds

  // Draw the wheel on canvas
  useEffect(() => {
    if (!canvasRef.current || segments.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const segmentAngle = (2 * Math.PI) / segments.length;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw segments
    segments.forEach((segment, index) => {
      const startAngle = index * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;

      // Draw segment
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = segment.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px sans-serif";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 3;
      ctx.fillText(segment.label, radius - 20, 5);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw center text
    ctx.fillStyle = "#333";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", centerX, centerY);
  }, [segments]);

  const handleSpin = () => {
    if (isSpinning || segments.length === 0) return;

    setIsSpinning(true);
    setWinner(null);

    // Random spin: 5-10 full rotations + random position
    const minSpins = 5;
    const maxSpins = 10;
    const spins = Math.random() * (maxSpins - minSpins) + minSpins;
    const randomDegree = Math.random() * 360;
    const totalRotation = spins * 360 + randomDegree;

    setRotation((prev) => prev + totalRotation);

    // Determine winner after spin
    setTimeout(() => {
      const segmentAngle = 360 / segments.length;
      const normalizedRotation = totalRotation % 360;
      // Calculate which segment is under the pointer at the top
      // After rotating by X degrees, the segment that's X degrees back is now at top
      const pointerAngle = (360 - normalizedRotation) % 360;
      const winningIndex = Math.floor(pointerAngle / segmentAngle) % segments.length;
      const winningSegment = segments[winningIndex];
      
      setWinner(winningSegment);
      setIsSpinning(false);
      
      toast.success(`You won: ${winningSegment.label}!`, {
        icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      });
      
      onSpin?.(winningSegment);
    }, spinDuration);
  };

  const handleReset = () => {
    setRotation(0);
    setWinner(null);
  };

  if (segments.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No wheel segments configured yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Contact your administrator to add wheel options.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">Spin the Wheel!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 p-6">
          {/* Pointer arrow at top */}
          <div className="relative w-full flex justify-center">
            <div className="absolute -top-4 z-10 w-0 h-0 border-l-[20px] border-r-[20px] border-t-[30px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
          </div>

          {/* Wheel */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="transition-transform ease-out"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: isSpinning ? `${spinDuration}ms` : "0ms",
              }}
            />
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <Button
              onClick={handleSpin}
              disabled={isSpinning}
              size="lg"
              className="min-w-[140px]"
            >
              {isSpinning ? "Spinning..." : "Spin the Wheel"}
            </Button>
            <Button
              onClick={handleReset}
              disabled={isSpinning}
              variant="outline"
              size="lg"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>

          {/* Winner display */}
          {winner && !isSpinning && (
            <Card className="w-full bg-primary/10 border-primary animate-scale-in">
              <CardContent className="p-6 text-center">
                <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Congratulations!
                </h3>
                <p className="text-lg text-muted-foreground">
                  You won: <span className="font-bold text-foreground">{winner.label}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
