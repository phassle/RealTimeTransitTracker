// PROTOTYPE — throwaway. Drop-in replacement for <ControlPanel> in dev that
// renders one of several "fancy" variants, chosen by the ?variant= URL param,
// with a floating switcher bar to flip between them. Hidden in production.
//
// Question being answered: "what should a fancier interface look like?"
// Sub-shape A — same map route, only the panel rendering swaps. See NOTES.md.
import { useEffect, useState } from 'react';
import { ControlPanel } from '../ControlPanel';
import { VariantGlassHud } from './VariantGlassHud';
import { VariantCommandDock } from './VariantCommandDock';
import { VariantIconRail } from './VariantIconRail';
import { PrototypeSwitcher } from './PrototypeSwitcher';

function useVariantParam() {
  const read = () => new URLSearchParams(window.location.search).get('variant') || 'C';
  const [variant, setVariant] = useState(read);
  useEffect(() => {
    const onChange = () => setVariant(read());
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return variant;
}

export function FancyControlPanel(props) {
  const variant = useVariantParam();

  let panel;
  if (variant === 'B') panel = <VariantCommandDock {...props} />;
  else if (variant === 'C') panel = <VariantIconRail {...props} />;
  else if (variant === 'original') panel = <ControlPanel {...props} />;
  else panel = <VariantGlassHud {...props} />;

  return (
    <>
      {panel}
      <PrototypeSwitcher current={variant} />
    </>
  );
}
