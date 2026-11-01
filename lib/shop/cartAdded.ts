/**
 * Sinjali "diçka u shtua në shportë". `addToCart` te AppStateContext e lajmëron, dhe `CartAddedHost` luan
 * animacionin e karrocës. Kështu animacioni del kudo ku shtohet në shportë (produkti, "Porosit përsëri",
 * kartat te Bebi), pa e shtuar veç e veç në çdo ekran.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function announceCartAdded(): void {
  for (const l of listeners) l();
}

export function onCartAdded(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
