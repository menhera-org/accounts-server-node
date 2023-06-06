
if (location.search != '') {
  const url = new URL(location.href);
  const params = url.searchParams;
  params.delete('error');
  params.delete('message');
  history.replaceState(null, null, url.href);
}
