import { T } from '../utils/theme.js';

/**
 * useAppStyles — returns the inline <style> JSX element for the app shell.
 *
 * Extracted from App.jsx to keep the component tree clean. Uses T.* theme
 * values directly via template literals, same as the original inline block.
 */
export default function useAppStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      ::-webkit-scrollbar{width:3px;}
      ::-webkit-scrollbar-track{background:${T.surface};}
      ::-webkit-scrollbar-thumb{background:${T.dim};border-radius:2px;}

      /* ── App shell ── */
      .app-shell{display:flex;height:100vh;overflow:hidden;background:${T.bg};color:${T.text};font-family:'Syne',sans-serif;}

      /* ── SIGNAL ── */
      .sig{width:168px;flex-shrink:0;background:transparent;display:flex;flex-direction:column;transition:width .25s cubic-bezier(.4,0,.2,1),padding .25s cubic-bezier(.4,0,.2,1),margin .25s cubic-bezier(.4,0,.2,1);padding:12px 0;position:relative;}
      .sig.sig-compass-open{width:400px;}
      .sig-inner{overflow:hidden;display:flex;flex-direction:column;flex:1;}
      .sig.collapsed{width:48px;padding:12px 0;margin-left:18px;margin-right:12px;}
      .sig.collapsed .sec,
      .sig.collapsed .wp-ttl,
      .sig.collapsed .wp-badge,
      .sig.collapsed .nova-lbl,
      .sig.collapsed .nova-pct,
      .sig.collapsed .nova-status,
      .sig.collapsed .plan-lbl,
      .sig.collapsed .plan-item-title,
      .sig.collapsed .plan-item-meta,
      .sig.collapsed .plan-refresh-btn,
      .sig.collapsed .prg-lbl,
      .sig.collapsed .prg-desc,
      .sig.collapsed .sig-brand,
      .sig.collapsed .sig-subt{display:none;}
      .sig.collapsed .nova-block{display:none !important;}
      .sig.collapsed .prg-txt{display:none !important;}
      .sec{padding:10px 11px 6px;}
      .secl{font-size:7.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;gap:5px;margin-bottom:8px;}
      .pip{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
      .fci{display:flex;align-items:center;gap:7px;padding:6px 7px;background:${T.card};border-radius:6px;margin-bottom:4px;cursor:pointer;border:1px solid transparent;transition:all .14s;}
      .fci:hover{border-color:${T.dim};}
      .fci.sel{border-color:${T.accent}50;background:${T.accent}08;}
      .fci-ico{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .fci-txt{font-size:10.5px;color:${T.text};line-height:1.25;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .fci-input{background:transparent;border:none;color:${T.text};font-family:'Syne',sans-serif;font-size:10.5px;width:100%;outline:none;padding:0;cursor:text;}
      .fci-input::placeholder{color:${T.muted};font-size:10px;}
      .grl{display:flex;align-items:center;gap:7px;padding:6px 7px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:all .14s;margin-bottom:3px;}
      .grl:hover{background:${T.card};}
      .grl.sel{background:${T.card};border-color:${T.accent}40;}
      .gr-pip{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
      .gr-nm{font-size:10.5px;color:${T.text};flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .gr-pc{font-size:9.5px;color:${T.muted};}
      .sig-add{margin:5px 11px 7px;padding:7px;background:${T.accentLo};border:1px solid ${T.accent}30;border-radius:6px;color:${T.accent};font-size:10.5px;text-align:center;cursor:pointer;letter-spacing:.04em;font-family:'Syne',sans-serif;font-weight:700;transition:all .14s;}
      .sig-add:hover{background:${T.accent}22;border-color:${T.accent}60;}

      /* ── Sidebar footer nav (Track / Settings) ── */
      .sig-ftr{display:flex;flex-direction:column;gap:4px;padding:10px 11px 0;margin-top:auto;border-top:1px solid ${T.border};}
      .sig-ftr-btn{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;border:1px solid transparent;background:transparent;color:${T.muted};font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.04em;cursor:pointer;transition:all .14s;white-space:nowrap;overflow:hidden;}
      .sig-ftr-btn:hover{background:${T.accent}10;border-color:${T.border};color:${T.text};}
      .sig.collapsed .sig-ftr{display:none;}

      /* ── COMMAND ── */
      .cmd{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;position:relative;}
      .cmd.wp-open .ctb{padding-right:249px;}
      .cmd.wp-open .cv{width:calc(100% - 249px);}
      .ctb{padding:11px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
      .cttl{font-size:14px;color:${T.accent};font-weight:700;letter-spacing:.1em;font-family:'Syne',sans-serif;}
      .cdt{font-size:9px;color:${T.muted};margin-top:2px;font-family:'IBM Plex Mono',monospace;}
      .cbtn{padding:6px 11px;background:${T.accentLo};border:1px solid ${T.accent}30;border-radius:20px;color:${T.accent};font-size:9.5px;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;white-space:nowrap;transition:all .14s;}
      .cbtn:hover{background:${T.accent}22;border-color:${T.accent}60;}
      .cbody{flex:1;overflow:hidden;position:relative;}
      .cv{width:100%;height:100%;position:relative;overflow:hidden;}
      .cv::-webkit-scrollbar{width:8px;height:8px;}
      .cv::-webkit-scrollbar-track{background:${T.bg};}
      .cv::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px;}
      .cv::-webkit-scrollbar-thumb:hover{background:${T.muted};}

      /* ── WAYPOINT ── */
      .wp{position:absolute;top:0;right:0;height:100%;width:0;overflow:hidden;background:${T.surface};display:flex;transition:width .4s cubic-bezier(.4,0,.2,1);z-index:20;box-shadow:-4px 0 24px rgba(0,0,0,.35);}
      .wp.open{width:249px;border-left:1px solid ${T.border};}
      .wpi{width:249px;flex-shrink:0;display:flex;flex-direction:column;height:100%;overflow:hidden;}
      .wp-accent{height:3px;flex-shrink:0;transition:background .25s;}
      .wp-hd{padding:13px 13px 10px;border-bottom:1px solid ${T.border};flex-shrink:0;position:relative;}
      .wp-close{position:absolute;top:9px;right:9px;width:20px;height:20px;border-radius:4px;background:${T.border};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;font-family:monospace;font-size:12px;color:${T.muted};line-height:1;transition:all .13s;}
      .wp-close:hover{background:${T.dim};color:${T.text};}
      .wp-badge{font-size:7.5px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px;display:flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;}
      .wp-ttl{font-size:14px;font-weight:700;letter-spacing:.04em;line-height:1.2;margin-bottom:4px;padding-right:24px;}
      .wp-dsc{font-size:10.5px;color:${T.muted};line-height:1.5;font-family:'IBM Plex Mono',monospace;}
      .wp-pg{padding:9px 13px;border-bottom:1px solid ${T.border};flex-shrink:0;}
      .wp-pgr{display:flex;justify-content:space-between;font-size:8.5px;color:${T.muted};margin-bottom:4px;font-family:'IBM Plex Mono',monospace;}
      .wp-pgtr{height:5px;background:${T.dim};border-radius:3px;overflow:hidden;}
      .wp-pgf{height:100%;border-radius:3px;transition:width .4s;}
      .wp-bdy{flex:1;overflow-y:auto;overflow-x:hidden;padding:9px 13px 4px;}
      .wp-ftr{flex-shrink:0;padding:4px 13px 12px;border-top:1px solid ${T.border}40;}
      .wp-bdy::-webkit-scrollbar{width:3px;}
      .wp-bdy::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
      .wsh{font-size:7.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.11em;margin:10px 0 5px;display:flex;align-items:center;gap:4px;font-family:'IBM Plex Mono',monospace;}
      .wsh:first-child{margin-top:0;}
      .wti{display:flex;align-items:flex-start;gap:7px;padding:5px 0;border-bottom:1px solid ${T.border}40;}
      .wck{width:14px;height:14px;border-radius:3px;border:1.5px solid ${T.dim};flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s;}
      .wck.done{background:${T.green}18;border-color:${T.green};}
      .wtx{font-size:10.5px;color:${T.text};line-height:1.35;flex:1;}
      .wtx.dn{color:${T.muted};text-decoration:line-through;}
      .wdm{width:14px;height:14px;border-radius:2.5px;border:1.5px solid ${T.blue}40;flex-shrink:0;margin-top:1px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s;}
      .wdm.done{border-color:${T.blue};background:${T.blue}18;}
      .w-del{opacity:0;background:none;border:none;color:${T.muted};font-size:12px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;transition:all .14s;}
      .wti:hover .w-del{opacity:1;}
      .w-del:hover{color:${T.rose};}
      .w-add-row{display:flex;gap:5px;margin-top:8px;}
      .w-add-inp{flex:1;background:${T.card};border:1px solid ${T.border};border-radius:5px;padding:5px 8px;color:${T.text};font-family:'IBM Plex Mono',monospace;font-size:10px;outline:none;}
      .w-add-inp:focus{border-color:${T.accent}60;}
      .w-add-inp::placeholder{color:${T.muted};}
      .w-add-btn{background:${T.card};border:1px solid ${T.border};border-radius:5px;padding:5px 8px;color:${T.muted};font-size:10px;cursor:pointer;font-family:'IBM Plex Mono',monospace;white-space:nowrap;transition:all .13s;}
      .w-add-btn:hover{border-color:${T.blue};color:${T.blue};}
      .wp-ai{margin:8px 12px 12px;border-radius:9px;overflow:hidden;flex-shrink:0;border:1px solid ${T.blue}25;}
      .wp-ai-h{padding:9px 12px 7px;border-bottom:1px solid ${T.border};display:flex;align-items:center;gap:8px;background:${T.blue}06;}
      .wp-ai-orb{width:28px;height:28px;border-radius:50%;border:1.5px solid ${T.blue}50;background:${T.blue}12;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${T.blue};}
      .wp-ai-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.blue};font-family:'IBM Plex Mono',monospace;}
      .wp-ai-sub{font-size:8.5px;color:${T.muted};margin-top:1px;font-family:'IBM Plex Mono',monospace;}
      .wp-ai-dot{width:7px;height:7px;border-radius:50%;background:${T.green};flex-shrink:0;}
      .wp-ai-b{padding:9px 12px;background:${T.card};}
      .wp-ai-msg{font-size:10.5px;color:${T.text};line-height:1.65;font-style:italic;font-family:'IBM Plex Mono',monospace;}
      .wp-ai-btns{display:flex;gap:5px;margin-top:8px;}
      .waib{flex:1;padding:6px 4px;border-radius:6px;font-size:8.5px;text-align:center;cursor:pointer;letter-spacing:.03em;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;border:1px solid;transition:filter .13s;background:none;}
      .waib:hover{filter:brightness(1.1);}
      .waib:disabled{opacity:.35;cursor:not-allowed;}
      .wp-await{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:8px;opacity:.4;padding-bottom:20px;}
      .wp-await-ico{width:38px;height:38px;border-radius:10px;background:${T.border};display:flex;align-items:center;justify-content:center;}
      .wp-await-txt{font-size:9.5px;color:${T.muted};text-align:center;line-height:1.6;max-width:140px;font-family:'IBM Plex Mono',monospace;}

      /* ── Modals ── */
      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px);}
      .modal{background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:28px;width:540px;max-width:94vw;max-height:90vh;overflow-y:auto;}
      .modal h2{font-size:17px;font-weight:800;margin-bottom:14px;color:${T.accent};letter-spacing:.06em;}
      .m-btns{display:flex;gap:8px;margin-top:8px;}
      .m-btns button{flex:1;padding:10px;border-radius:6px;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;}
      .m-ok{background:${T.accent};border:none;color:#000;}
      .m-ok:hover{opacity:.9;}
      .m-ok:disabled{opacity:.35;cursor:not-allowed;}
      .m-cancel{background:transparent;border:1px solid ${T.border};color:${T.muted};}
      .m-cancel:hover{border-color:${T.muted};color:${T.text};}
      .smart-status{display:flex;align-items:center;gap:5px;margin-bottom:18px;padding:9px 12px;background:${T.surface};border-radius:8px;border:1px solid ${T.border};}
      .s-dot{width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'IBM Plex Mono',monospace;transition:all .18s;flex-shrink:0;}
      .s-dot.on{background:${T.green}18;color:${T.green};border:1px solid ${T.green}45;}
      .s-dot.off{background:${T.dim};color:${T.muted};border:1px solid ${T.border};}
      .smart-field{margin-bottom:15px;}
      .smart-lbl{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
      .smart-badge{width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'IBM Plex Mono',monospace;flex-shrink:0;}
      .smart-name{font-size:12px;font-weight:700;letter-spacing:.04em;}
      .smart-hint{font-size:10px;color:${T.muted};font-family:'IBM Plex Mono',monospace;margin-left:auto;}
      .s-inp{width:100%;box-sizing:border-box;background:${T.surface};border:1px solid ${T.border};border-radius:6px;padding:8px 11px;color:${T.text};font-family:'Syne',sans-serif;font-size:12px;outline:none;transition:border-color .15s;display:block;}
      .s-inp:focus{border-color:${T.accent}60;}
      .s-inp::placeholder{color:${T.muted};font-size:11px;}
      .s-inp.ok{border-color:${T.green}35;}
      @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3);}}

      /* ── Responsive Scaling ── */
      .sig-brand{font-size:clamp(17px, 1.55vw, 24px);}
      .sig-subt{font-size:clamp(9px, 0.77vw, 12px);}
      .secl{font-size:clamp(10px, 0.88vw, 13px);}
      .fci-input,.fci-txt,.gr-nm{font-size:clamp(13px, 1.15vw, 16px);}
      .gr-pc{font-size:clamp(12px, 1.05vw, 15px);}
      .sig-add{font-size:clamp(13px, 1.1vw, 16px);}
      .cttl{font-size:clamp(18px, 1.55vw, 24px);}
      .cdt{font-size:clamp(12px, 1.05vw, 15px);}
      .cbtn{font-size:clamp(12px, 1.05vw, 15px);}
      .wp-ttl{font-size:clamp(18px, 1.55vw, 24px);}
      .wp-badge{font-size:clamp(10px, 0.88vw, 13px);}
      .wp-dsc{font-size:clamp(13px, 1.15vw, 16px);}
      .wtx{font-size:clamp(14px, 1.27vw, 18px);}
      .wp-ai-msg{font-size:clamp(14px, 1.27vw, 18px);}
      .wp-ai-lbl{font-size:clamp(13px, 1.1vw, 15px);}
      .wp-ai-sub{font-size:clamp(11px, 0.94vw, 13px);}
      .waib{font-size:clamp(11px, 0.94vw, 13px);}
      .w-add-inp,.w-add-btn{font-size:clamp(13px, 1.1vw, 15px);}
      .wp-pgr{font-size:clamp(11px, 0.94vw, 13px);}
      .wsh{font-size:clamp(10px, 0.88vw, 12px);}
      .wp-await-txt{font-size:clamp(13px, 1.1vw, 15px);}
      .nova-lbl{font-size:9px;}
      .nova-pct{font-size:11px;}
      .nova-status{font-size:9px;}
      .plan-lbl{font-size:9px;}
      .plan-item-title{font-size:9px;}
      .plan-item-meta{font-size:8px;}
      .plan-refresh-btn{font-size:8px;}

      /* Base sizes (1440px - 1919px) */
      .sig{width:235px;}
      .sig.sig-compass-open{width:400px;}
      .sec{padding:14px 14px 10px;}
      .sig-add{margin:6px 14px 10px;padding:9px;}
      .wp.open{width:352px;}
      .wpi{width:352px;}
      .cmd.wp-open .ctb{padding-right:352px;}
      .cmd.wp-open .cv{width:calc(100% - 352px);}
      .wp-hd{padding:16px 16px 12px;}
      .wp-pg{padding:12px 16px;}
      .wp-bdy{padding:12px 16px 6px;}
      .wp-ftr{padding:6px 16px 14px;}
      .wp-ai{margin:10px 14px 14px;}
      .wp-ai-h{padding:12px 14px 10px;}
      .wp-ai-b{padding:12px 14px;}
      .wp-ai-orb{width:32px;height:32px;}
      .ctb{padding:14px 18px;}
      .fci-ico{width:26px;height:26px;}
      .fci{padding:8px 10px;}
      .grl{padding:8px 10px;}
      .gr-pip{width:10px;height:10px;}
      .wck,.wdm{width:18px;height:18px;}
      .wp-close{width:24px;height:24px;font-size:14px;}

      @media (max-width: 1439px) {
        .sig{width:216px;}
        .sig.sig-compass-open{width:380px;}
        .wp.open{width:305px;}
        .wpi{width:305px;}
        .cmd.wp-open .ctb{padding-right:305px;}
        .cmd.wp-open .cv{width:calc(100% - 305px);}
        .sec{padding:12px 12px 8px;}
        .sig-add{margin:5px 12px 8px;padding:8px;}
        .wp-hd{padding:14px 14px 10px;}
        .wp-pg{padding:10px 14px;}
        .wp-bdy{padding:10px 14px 5px;}
        .wp-ftr{padding:5px 14px 12px;}
        .wp-ai{margin:8px 12px 12px;}
        .wp-ai-h{padding:10px 12px 8px;}
        .wp-ai-b{padding:10px 12px;}
        .wp-ai-orb{width:28px;height:28px;}
        .ctb{padding:12px 16px;}
        .fci-ico{width:24px;height:24px;}
        .fci{padding:7px 8px;}
        .grl{padding:7px 8px;}
      }

      @media (max-width: 1365px) {
        .sig{width:193px;}
        .sig.sig-compass-open{width:360px;}
        .wp.open{width:281px;}
        .wpi{width:281px;}
        .cmd.wp-open .ctb{padding-right:281px;}
        .cmd.wp-open .cv{width:calc(100% - 281px);}
        .sec{padding:10px 10px 6px;}
        .sig-add{margin:4px 10px 6px;padding:7px;}
        .wp-hd{padding:12px 12px 9px;}
        .wp-pg{padding:9px 12px;}
        .wp-bdy{padding:9px 12px 4px;}
        .wp-ftr{padding:4px 12px 10px;}
        .wp-ai{margin:7px 10px 10px;}
        .wp-ai-h{padding:9px 10px 7px;}
        .wp-ai-b{padding:9px 10px;}
        .wp-ai-orb{width:26px;height:26px;}
        .ctb{padding:10px 14px;}
        .fci-ico{width:22px;height:22px;}
        .fci{padding:6px 7px;}
        .grl{padding:6px 7px;}
        .gr-pip{width:9px;height:9px;}
      }

      @media (min-width: 1920px) {
        .sig{width:278px;}
        .sig.sig-compass-open{width:440px;}
        .wp.open{width:399px;}
        .wpi{width:399px;}
        .cmd.wp-open .ctb{padding-right:399px;}
        .cmd.wp-open .cv{width:calc(100% - 399px);}
        .sec{padding:18px 18px 12px;}
        .sig-add{margin:8px 18px 12px;padding:11px;}
        .wp-hd{padding:20px 20px 16px;}
        .wp-pg{padding:14px 20px;}
        .wp-bdy{padding:14px 20px 8px;}
        .wp-ftr{padding:8px 20px 18px;}
        .wp-ai{margin:12px 18px 18px;}
        .wp-ai-h{padding:14px 18px 12px;}
        .wp-ai-b{padding:14px 18px;}
        .wp-ai-orb{width:38px;height:38px;}
        .ctb{padding:18px 24px;}
        .fci-ico{width:30px;height:30px;}
        .fci{padding:10px 12px;}
        .grl{padding:10px 12px;}
        .gr-pip{width:12px;height:12px;}
        .wck,.wdm{width:20px;height:20px;}
        .wp-close{width:28px;height:28px;font-size:16px;}
        .nova-lbl{font-size:11px;}
        .nova-pct{font-size:14px;}
        .nova-status{font-size:11px;}
        .plan-lbl{font-size:11px;}
        .plan-item-title{font-size:11px;}
        .plan-item-meta{font-size:10px;}
        .plan-refresh-btn{font-size:10px;}
      }

      @media (min-width: 2560px) {
        .sig{width:259px;}
        .sig.sig-compass-open{width:500px;}
        .wp.open{width:469px;}
        .wpi{width:469px;}
        .cmd.wp-open .ctb{padding-right:469px;}
        .cmd.wp-open .cv{width:calc(100% - 469px);}
        .sec{padding:22px 22px 16px;}
        .sig-add{margin:10px 22px 16px;padding:13px;}
        .wp-hd{padding:24px 24px 20px;}
        .wp-pg{padding:18px 24px;}
        .wp-bdy{padding:18px 24px 10px;}
        .wp-ftr{padding:10px 24px 22px;}
        .wp-ai{margin:14px 22px 22px;}
        .wp-ai-h{padding:16px 22px 14px;}
        .wp-ai-b{padding:16px 22px;}
        .wp-ai-orb{width:44px;height:44px;}
        .wp-ai-orb svg{width:18px;height:18px;}
        .ctb{padding:22px 28px;}
        .fci-ico{width:36px;height:36px;}
        .fci-ico svg{width:14px;height:14px;}
        .fci{padding:12px 14px;}
        .grl{padding:12px 14px;}
        .gr-pip{width:14px;height:14px;}
        .wck,.wdm{width:22px;height:22px;}
        .wp-close{width:32px;height:32px;font-size:18px;}
        .nova-lbl{font-size:13px;}
        .nova-pct{font-size:17px;}
        .nova-status{font-size:13px;}
        .plan-lbl{font-size:13px;}
        .plan-item-title{font-size:13px;}
        .plan-item-meta{font-size:12px;}
        .plan-refresh-btn{font-size:12px;}
      }

      @media (max-width: 1200px) {
        .sig{width:129px;}
        .sig.sig-compass-open{width:340px;}
        .wp.open{width:258px;}
        .wpi{width:258px;}
        .cmd.wp-open .ctb{padding-right:258px;}
        .cmd.wp-open .cv{width:calc(100% - 258px);}
        .sec{padding:8px 9px 5px;}
        .wp-ftr{padding:4px 9px 10px;}
        .fci-ico{width:20px;height:20px;}
        .wp-ai-orb{width:24px;height:24px;}
      }
    `}</style>
  );
}
