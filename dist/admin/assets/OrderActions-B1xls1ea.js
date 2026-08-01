import{l as c,r as h,t as p,j as e}from"./index-DJspXmXb.js";import{C as d}from"./copy-CXHdWe-A.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=c("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=c("MessageCircle",[["path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z",key:"vv11sd"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=c("Phone",[["path",{d:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",key:"foiqr5"}]]);function u({phone:t,orderNumber:o}){const[n,r]=h.useState(!1),i=`https://wa.me/${p(t)}`+(o?`?text=${encodeURIComponent("بخصوص طلبك رقم "+o)}`:""),s="grid h-9 w-9 place-items-center rounded-lg transition";async function l(a){a.stopPropagation();try{await navigator.clipboard.writeText(t),r(!0),setTimeout(()=>r(!1),1500)}catch{}}return e.jsxs("div",{className:"flex items-center gap-1.5",onClick:a=>a.stopPropagation(),children:[e.jsx("a",{href:i,target:"_blank",rel:"noopener",className:`${s} bg-success-soft text-success hover:brightness-95`,title:"واتساب","aria-label":"واتساب",children:e.jsx(x,{className:"h-4 w-4"})}),e.jsx("a",{href:`tel:${t}`,className:`${s} bg-brand-soft text-brand-dark hover:brightness-95`,title:"اتصال","aria-label":"اتصال",children:e.jsx(g,{className:"h-4 w-4"})}),e.jsx("button",{onClick:l,className:`${s} bg-line/50 text-muted hover:bg-line`,title:"نسخ رقم الهاتف","aria-label":"نسخ رقم الهاتف",children:n?e.jsx(m,{className:"h-4 w-4 text-success"}):e.jsx(d,{className:"h-4 w-4"})})]})}export{m as C,u as O};
