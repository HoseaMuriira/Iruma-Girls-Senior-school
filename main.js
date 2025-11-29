// Navigation helpers, slideshow, and theme persistence
document.addEventListener('DOMContentLoaded', ()=>{
  // Theme persistence
  const btn = document.getElementById('themeToggle');
  const current = localStorage.getItem('theme');
  if(current === 'dark') document.documentElement.classList.add('dark');
  if(btn) btn.addEventListener('click', ()=>{
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });

  // Slideshow
  let idx = 0;

  // Footer maps: load Leaflet dynamically and initialise any .footer-map elements
  const mapWrappers = document.querySelectorAll('.footer-map');
  if(mapWrappers && mapWrappers.length){
    // load Leaflet CSS + JS only once
    function loadLeaflet(){
      return new Promise((resolve, reject)=>{
        if(window.L) return resolve();
        // CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        // JS
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.async = true;
        s.onload = ()=>resolve();
        s.onerror = (e)=>reject(e);
        document.head.appendChild(s);
      });
    }

    function setupMaps(){
      mapWrappers.forEach(wrapper => {
        try{
          const lat = parseFloat(wrapper.getAttribute('data-lat')) || -0.3340;
          const lng = parseFloat(wrapper.getAttribute('data-lng')) || 37.6390;
          const locked = wrapper.getAttribute('data-locked') === 'true';
          const mapEl = wrapper.querySelector('.map-instance');
          if(!mapEl) return;

          // ensure the container has an id (Leaflet prefers an id or a dom node)
          if(!mapEl.id) mapEl.id = 'map-' + Math.random().toString(36).slice(2,9);

          const mapOptions = {
            center: [lat, lng],
            zoom: 16,
            dragging: !locked,
            scrollWheelZoom: !locked,
            doubleClickZoom: !locked,
            zoomControl: !locked
          };

          const map = L.map(mapEl.id, mapOptions);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          // school marker
          const schoolMarker = L.marker([lat, lng]).addTo(map).bindPopup('<strong>Iruma Girls Senior School</strong>').openPopup();

          // controls
          const unlockBtn = wrapper.querySelector('.map-unlock');
          const locateBtn = wrapper.querySelector('.map-locate');

          if(unlockBtn){
            const setLocked = (wantLocked) => {
              if(wantLocked){
                map.dragging.disable(); map.scrollWheelZoom.disable(); map.doubleClickZoom.disable(); if(map.zoomControl) map.zoomControl.remove(); unlockBtn.textContent = 'Unlock';
              } else {
                map.dragging.enable(); map.scrollWheelZoom.enable(); map.doubleClickZoom.enable(); if(!map.zoomControl) map.zoomControl = L.control.zoom().addTo(map); unlockBtn.textContent = 'Lock';
              }
            };
            // initial
            setLocked(locked);
            unlockBtn.addEventListener('click', ()=>{
              const nowLocked = wrapper.getAttribute('data-locked') === 'true';
              wrapper.setAttribute('data-locked', (!nowLocked).toString());
              setLocked(!nowLocked);
            });
          }

          if(locateBtn){
            let userMarker = null;
            let userCircle = null;
            locateBtn.addEventListener('click', ()=>{
              if(!navigator.geolocation){
                alert('Geolocation is not supported by your browser.');
                return;
              }
              locateBtn.disabled = true; locateBtn.textContent = 'Locating…';
              navigator.geolocation.getCurrentPosition(position => {
                const lat2 = position.coords.latitude;
                const lng2 = position.coords.longitude;
                if(userMarker) { userMarker.setLatLng([lat2,lng2]); }
                else { userMarker = L.marker([lat2, lng2], {title:'Your location'}).addTo(map).bindPopup('You are here').openPopup(); }
                if(userCircle) { userCircle.setLatLng([lat2,lng2]); userCircle.setRadius(position.coords.accuracy || 50);} 
                else { userCircle = L.circle([lat2, lng2], {radius: position.coords.accuracy || 50, color: '#0077ff', opacity:0.3}).addTo(map); }
                // show both markers
                const group = L.featureGroup([schoolMarker, userMarker]);
                map.fitBounds(group.getBounds().pad(0.6));
                locateBtn.disabled = false; locateBtn.textContent = 'Use my location';
              }, err => {
                locateBtn.disabled = false; locateBtn.textContent = 'Use my location';
                if(err.code === 1) alert('Location permission denied. Allow location access to use this feature.');
                else alert('Could not fetch location: '+err.message);
              }, {enableHighAccuracy: true, timeout: 15000});
            });
          }

        }catch(e){ console.warn('map init failed', e); }
      });
    }

    loadLeaflet().then(setupMaps).catch(e=>console.error('Failed to load maps', e));
  }

  // Profile fetch: populate profile panels across portal/dashboard pages
  async function fetchProfile(){
    try{
      const res = await fetch('/api/profile', { credentials: 'same-origin' });
      if(!res.ok){
        // not logged in or no profile
        document.querySelectorAll('#myProfile').forEach(el=>{
          el.style.display = 'none';
        });
        const fallback = document.getElementById('profileFallback');
        if(fallback) fallback.style.display = 'block';
        return;
      }
      const data = await res.json();
      if(!data || !data.ok) return;
      const profile = data.profile || {};
      document.querySelectorAll('#myProfile').forEach(el=>{
        // show the profile block
        el.style.display = '';
        const user = profile.user || {};
        const student = profile.student || {};
        const setText = (selector, value) => {
          const node = el.querySelector(selector);
          if(node) node.textContent = value ?? '—';
        };
        setText('.profile-name', user.fullname || '—');
        setText('.profile-email', user.email || '—');
        setText('.profile-role', user.role || '—');
        setText('.profile-admission', student.admission_no || '—');
        setText('.profile-year', student.year || '—');
        setText('.profile-pathway', student.pathway || '—');
        setText('.profile-assigned', user.role === 'teacher' ? 'Assigned classes' : '—');
      });

      // hook logout link(s)
      document.querySelectorAll('.profileLogout').forEach(btn=>{
        btn.addEventListener('click', async (e)=>{
          e.preventDefault();
          await fetch('/api/auth/logout', { method:'POST', credentials:'same-origin' });
          location.reload();
        });
      });

    }catch(err){ console.warn('profile fetch failed', err); }
  }

  // try fetching profile after content loads
  fetchProfile();
  const slides = document.querySelectorAll('.slide');
  function show(i){
    slides.forEach(s=>s.classList.remove('active'));
    if(slides[i]) slides[i].classList.add('active');
  }
  if(slides.length){
    show(0);
    setInterval(()=>{ idx = (idx+1)%slides.length; show(idx); }, 5000);
  }
  // Prev/Next
  const prev = document.querySelector('.slideshow-controls .prev');
  const next = document.querySelector('.slideshow-controls .next');
  if(prev) prev.addEventListener('click', ()=>{ idx = (idx-1+slides.length)%slides.length; show(idx); });
  if(next) next.addEventListener('click', ()=>{ idx = (idx+1)%slides.length; show(idx); });
});
