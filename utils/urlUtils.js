export function isYouTubeUrl(url) {
    const patterns = [
        /youtube\.com\/watch\?v=/i,
        /youtu\.be\//i,
        /youtube\.com\/shorts\//i,
        /youtube\.com\/embed\//i,
        /youtube\.com\/v\//i,
        /youtube\.com\/playlist\?list=/i,
        /m\.youtube\.com/i,
        /youtube\.com\/live\//i
    ];
    return patterns.some(p => p.test(url));
}
