export const artUrl = (id: string) => `${import.meta.env.BASE_URL}art/${id}.png`;

export function Sprite({ id, size, flip, className, alt = '' }: { id: string; size: number; flip?: boolean; className?: string; alt?: string }) {
  return <img src={artUrl(id)} alt={alt} width={size} height={size} className={`sprite ${flip ? 'flip ' : ''}${className ?? ''}`} />;
}
