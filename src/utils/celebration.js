import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
    const end = Date.now() + 3 * 1000;
    const colors = ['#bc13fe', '#7d12ff', '#ffffff'];

    (function frame() {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
};
