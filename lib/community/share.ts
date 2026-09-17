import { Share } from "react-native";
import * as Linking from "expo-linking";

/**
 * Ndan një postim përmes menusë së sistemit (WhatsApp, Viber, Messenger...).
 * Lidhja `bebix://community/post/<id>` e hap postimin direkt në app te kush e
 * ka të instaluar.
 */
export async function sharePost(post: { id: string; authorName: string; text: string }): Promise<void> {
  const link = Linking.createURL(`community/post/${post.id}`);
  const excerpt = post.text.trim().length > 140 ? `${post.text.trim().slice(0, 140)}…` : post.text.trim();
  const body = excerpt ? `“${excerpt}” — ${post.authorName}` : `Postim nga ${post.authorName}`;

  try {
    await Share.share({
      title: "Bebix · Komuniteti",
      message: `${body}\n\nShiko në Bebix: ${link}`,
    });
  } catch {
    // Përdoruesi e mbylli menunë ose pajisja s'e mbështet — s'ka nevojë për gabim.
  }
}
