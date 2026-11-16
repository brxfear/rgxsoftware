/** YouTube linkinden sessiz, döngülü, kontrolsüz gömme adresi (yoksa null) */
export const youtubeLoopEmbed = (url) => {
  const m = String(url || '').match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  const id = m && m[2].length === 11 ? m[2] : null;
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0` : null;
};

/** settings/hero → vitrinde gösterilecek içerik: { kind: 'image'|'video'|'embed'|'auto', url } */
export const resolveHero = (hero, fallbackShot) => {
  const mode = hero?.mode || 'auto';
  if (mode === 'video' && hero?.video_url) {
    const embed = youtubeLoopEmbed(hero.video_url);
    return embed ? { kind: 'embed', url: embed } : { kind: 'video', url: hero.video_url, poster: hero.image_url || '' };
  }
  if (mode === 'image' && hero?.image_url) return { kind: 'image', url: hero.image_url };
  return fallbackShot ? { kind: 'image', url: fallbackShot } : { kind: 'auto', url: '' };
};
