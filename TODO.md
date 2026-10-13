# TODO

## Product

- Burndown charts.

## Known gaps

- Only one backend process may serve a data directory.
- A workspace's attached files have no total limit: each is at most 10 MB, and nothing shows or frees what a
  workspace uses.
- A page across projects shows the first issues of its order in every layout: its board is not paged per
  column, and its calendar shows the loaded issues due in a month, not all of them.
- Search finds the words typed anywhere in a title, a description or a comment, and a key only when typed
  whole. It has no full-text index: each search reads every issue and comment.
- The content security policy is a meta tag of the built page, which cannot say who may frame it: the backend
  sends `X-Frame-Options` with the pages it serves, and another host of the pages has to send its own.
- HTML written into a description through the API is dropped when shown, not shown as text.
