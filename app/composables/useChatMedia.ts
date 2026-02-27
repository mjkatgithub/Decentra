import type { Ref } from "vue";
import { decryptMediaBlob, fetchMediaBlob } from "~/utils/mediaUtils";

interface MediaPayload {
  mxcUrl: string;
  mimetype?: string;
  isEncrypted?: boolean;
  encryptionInfo?: Record<string, any>;
}

export function useChatMedia(client: Ref<Record<string, any> | null>) {
  function appendAccessTokenToMediaUrl(
    avatarUrl: string | null | undefined,
  ): string | undefined {
    if (!avatarUrl) {
      return undefined;
    }
    const matrixClient = client.value;
    const accessToken = matrixClient?.getAccessToken?.();
    if (!accessToken || !avatarUrl.includes("/_matrix/")) {
      return avatarUrl;
    }
    if (avatarUrl.includes("access_token=")) {
      return avatarUrl;
    }
    const separator = avatarUrl.includes("?") ? "&" : "?";
    return `${avatarUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
  }

  function getSpaceAvatarUrl(
    spaceRoom: Record<string, any>,
  ): string | undefined {
    const matrixClient = client.value;
    const homeserverUrl = matrixClient?.getHomeserverUrl?.();
    const getAvatarUrl = spaceRoom.getAvatarUrl;
    const accessToken = matrixClient?.getAccessToken?.();

    const withAccessToken = (
      url: string | null | undefined,
    ): string | undefined => {
      if (!url) {
        return undefined;
      }
      if (!accessToken || !url.includes("/_matrix/")) {
        return url;
      }
      if (url.includes("access_token=")) {
        return url;
      }
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}access_token=${encodeURIComponent(accessToken)}`;
    };

    if (homeserverUrl && typeof getAvatarUrl === "function") {
      const httpAvatarUrl = getAvatarUrl.call(
        spaceRoom,
        homeserverUrl,
        40,
        40,
        "crop",
        false,
        true,
      ) as string | null;
      if (httpAvatarUrl) {
        return withAccessToken(httpAvatarUrl);
      }
    }

    const avatarMxcFromRoom = spaceRoom.getMxcAvatarUrl?.();
    const avatarStateEvent = spaceRoom.currentState?.getStateEvents?.(
      "m.room.avatar",
      "",
    );
    const avatarMxcUrl =
      avatarMxcFromRoom || avatarStateEvent?.getContent?.()?.url;
    if (!avatarMxcUrl || !matrixClient?.mxcUrlToHttp) {
      return undefined;
    }

    try {
      const httpUrl = matrixClient.mxcUrlToHttp(
        avatarMxcUrl,
        40,
        40,
        "crop",
        false,
        true,
        true,
      ) as string;
      return withAccessToken(httpUrl);
    } catch {
      return undefined;
    }
  }

  function getMemberAvatarUrl(member: Record<string, any>): string | undefined {
    const matrixClient = client.value;
    const homeserverUrl = matrixClient?.getHomeserverUrl?.();
    const getAvatarUrl = member.getAvatarUrl;
    if (homeserverUrl && typeof getAvatarUrl === "function") {
      const avatarUrl = getAvatarUrl.call(
        member,
        homeserverUrl,
        40,
        40,
        "crop",
        false,
        false,
        true,
      ) as string | null;
      if (avatarUrl) {
        return appendAccessTokenToMediaUrl(avatarUrl);
      }
    }

    const avatarMxcUrl = member.events?.member?.getContent?.()?.avatar_url;
    if (!avatarMxcUrl || !matrixClient?.mxcUrlToHttp) {
      return undefined;
    }
    const avatarUrl = matrixClient.mxcUrlToHttp(
      avatarMxcUrl,
      40,
      40,
      "crop",
      false,
      true,
      true,
    );
    return appendAccessTokenToMediaUrl(avatarUrl);
  }

  function getMediaUrl(
    mxcUrl: string | null | undefined,
    mimetype?: string,
    body?: string,
  ): string | undefined {
    if (!mxcUrl || !client.value?.mxcUrlToHttp) {
      return undefined;
    }
    try {
      const httpUrl = client.value.mxcUrlToHttp(
        mxcUrl,
        800,
        800,
        "scale",
        false,
        true,
        true,
      );
      return appendAccessTokenToMediaUrl(httpUrl);
    } catch {
      return undefined;
    }
  }

  async function resolveMediaBlobUrl(media: MediaPayload): Promise<string> {
    const matrixClient = client.value;
    if (!matrixClient) {
      throw new Error("No client available");
    }

    const accessToken = matrixClient.getAccessToken?.() ?? "";
    const httpUrl = matrixClient.mxcUrlToHttp(
      media.mxcUrl,
      undefined,
      undefined,
      undefined,
      false,
      true,
      true,
    );
    if (!httpUrl) {
      throw new Error("Could not resolve MXC URL");
    }

    if (media.isEncrypted && media.encryptionInfo) {
      return decryptMediaBlob(
        httpUrl,
        accessToken,
        media.encryptionInfo as any,
        media.mimetype,
      );
    }
    return fetchMediaBlob(httpUrl, accessToken);
  }

  return {
    getSpaceAvatarUrl,
    getMemberAvatarUrl,
    getMediaUrl,
    resolveMediaBlobUrl,
  };
}
