import { useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const TableauDashboard = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Create the Tableau placeholder div
    const placeholderDiv = document.createElement('div');
    placeholderDiv.className = 'tableauPlaceholder';
    placeholderDiv.id = 'viz1769186887619';
    placeholderDiv.style.position = 'relative';
    placeholderDiv.style.width = '100%';

    // Create noscript element
    const noscript = document.createElement('noscript');
    const noscriptLink = document.createElement('a');
    noscriptLink.href = '#';
    const noscriptImg = document.createElement('img');
    noscriptImg.alt = 'Risks Hosp Dashboard';
    noscriptImg.src = 'https://public.tableau.com/static/images/CT/CTAM/RisksHospDashboard/1_rss.png';
    noscriptImg.style.border = 'none';
    noscriptLink.appendChild(noscriptImg);
    noscript.appendChild(noscriptLink);

    // Create object element
    const objectEl = document.createElement('object');
    objectEl.className = 'tableauViz';
    objectEl.style.display = 'none';

    const params = [
      { name: 'host_url', value: 'https%3A%2F%2Fpublic.tableau.com%2F' },
      { name: 'embed_code_version', value: '3' },
      { name: 'site_root', value: '' },
      { name: 'name', value: 'CTAM/RisksHospDashboard' },
      { name: 'tabs', value: 'no' },
      { name: 'toolbar', value: 'yes' },
      { name: 'static_image', value: 'https://public.tableau.com/static/images/CT/CTAM/RisksHospDashboard/1.png' },
      { name: 'animate_transition', value: 'yes' },
      { name: 'display_static_image', value: 'yes' },
      { name: 'display_spinner', value: 'yes' },
      { name: 'display_overlay', value: 'yes' },
      { name: 'display_count', value: 'yes' },
      { name: 'language', value: 'en-US' }
    ];

    params.forEach(p => {
      const param = document.createElement('param');
      param.name = p.name;
      param.value = p.value;
      objectEl.appendChild(param);
    });

    placeholderDiv.appendChild(noscript);
    placeholderDiv.appendChild(objectEl);
    containerRef.current.appendChild(placeholderDiv);

    // Set responsive sizing
    const vizElement = objectEl;
    const containerWidth = containerRef.current.offsetWidth;
    if (containerWidth > 800) {
      vizElement.style.width = '100%';
      vizElement.style.height = '1027px';
    } else if (containerWidth > 500) {
      vizElement.style.width = '100%';
      vizElement.style.height = '1027px';
    } else {
      vizElement.style.width = '100%';
      vizElement.style.height = '1777px';
    }

    // Load Tableau script
    const scriptElement = document.createElement('script');
    scriptElement.src = 'https://public.tableau.com/javascripts/api/viz_v1.js';
    placeholderDiv.insertBefore(scriptElement, vizElement);

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            แดชบอร์ดศูนย์เทคโนโลยีสารสนเทศ
          </h1>
          <p className="text-muted-foreground mt-1">
            รายงานความเสี่ยงและสถานะความปลอดภัยไซเบอร์ของโรงพยาบาล
          </p>
        </div>
        
        <div 
          ref={containerRef} 
          className="w-full bg-card rounded-lg border shadow-sm overflow-hidden"
        />
      </div>
    </DashboardLayout>
  );
};

export default TableauDashboard;
