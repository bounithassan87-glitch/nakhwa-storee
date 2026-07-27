import{i as t,r as h,j as e}from"./index-BuRDZz8A.js";import{t as p}from"./format-C-2hSbrs.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=t("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=t("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=t("MessageCircle",[["path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z",key:"vv11sd"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=t("Phone",[["path",{d:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",key:"foiqr5"}]]);function u({phone:s,orderNumber:r}){const[i,o]=h.useState(!1),n=`https://wa.me/${p(s)}`+(r?`?text=${encodeURIComponent("بخصوص طلبك رقم "+r)}`:""),a="grid h-9 w-9 place-items-center rounded-lg transition";async function l(c){c.stopPropagation();try{await navigator.clipboard.writeText(s),o(!0),setTimeout(()=>o(!1),1500)}catch{}}return e.jsxs("div",{className:"flex items-center gap-1.5",onClick:c=>c.stopPropagation(),children:[e.jsx("a",{href:n,target:"_blank",rel:"noopener",className:`${a} bg-success-soft text-success hover:brightness-95`,title:"واتساب","aria-label":"واتساب",children:e.jsx(m,{className:"h-4 w-4"})}),e.jsx("a",{href:`tel:${s}`,className:`${a} bg-brand-soft text-brand-dark hover:brightness-95`,title:"اتصال","aria-label":"اتصال",children:e.jsx(g,{className:"h-4 w-4"})}),e.jsx("button",{onClick:l,className:`${a} bg-line/50 text-muted hover:bg-line`,title:"نسخ رقم الهاتف","aria-label":"نسخ رقم الهاتف",children:i?e.jsx(d,{className:"h-4 w-4 text-success"}):e.jsx(x,{className:"h-4 w-4"})})]})}export{d as C,u as O};
