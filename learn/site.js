const input = document.querySelector('#node-search');
if (input) {
  const cards = [...document.querySelectorAll('[data-node-card]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  let category = 'all';
  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || '';
  const filter = () => {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const visible = (category === 'all' || card.dataset.category === category) && terms.every(t => card.dataset.search.includes(t));
      card.hidden = !visible;
      if (visible) count++;
    }
    document.querySelector('.result-count').textContent = `${count} node ${count === 1 ? 'guide' : 'guides'}`;
    document.querySelector('#empty-state').classList.toggle('hidden', count !== 0);
    const url = new URL(location.href);
    if (input.value.trim()) url.searchParams.set('q',input.value.trim()); else url.searchParams.delete('q');
    history.replaceState(null,'',url);
  };
  input.addEventListener('input',filter);
  for (const button of filters) button.addEventListener('click',() => {
    category = button.dataset.filter;
    for(const b of filters){const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
    filter();
  });
  document.querySelector('#reset-search').addEventListener('click',() => {
    input.value='';filters[0].click();input.focus();
  });
  filter();
}
