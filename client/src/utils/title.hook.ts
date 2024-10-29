import { useEffect } from "react";

// Make sure to keep this in sync with the <title> in index.html
export const defaultTitle = 'Kaarna - aikataulutuksen pettuleipä';

export default function useSetTitle(
  title?: string,
  addSiteName: boolean = true,
) {
  useEffect(() => {
    if (title) {
      if (addSiteName) {
        document.title = title + ' - Kaarna';
      } else {
        document.title = title;
      }
    } else {
      document.title = defaultTitle;
    }
  }, [title, addSiteName]);
}
