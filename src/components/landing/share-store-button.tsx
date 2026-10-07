"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareStoreButtonProps {
  storeName: string;
  storeSlug: string;
}

export function ShareStoreButton({ storeName, storeSlug }: ShareStoreButtonProps) {
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to the store page
    
    // Construct the full URL with a unique timestamp to always bypass WhatsApp cache
    const url = `${window.location.origin}/loja/${storeSlug}?v=${Date.now()}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Loja ${storeName} no ShopLink`,
          text: `Veja a loja ${storeName} e os seus produtos no ShopLink!`,
          url: url,
        });
      } catch (err) {
        console.error("Erro ao partilhar", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Link copiado para a área de transferência!");
      } catch (err) {
        console.error("Erro ao copiar", err);
      }
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleShare}
      className="h-8 w-8 rounded-full p-0 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
      title="Partilhar loja"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
