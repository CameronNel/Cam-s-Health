// Independent plan for the shared status/recovery audit; never infer it from captures.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROFILES} from './harness.mjs';
const repository=fileURLToPath(new URL('../../',import.meta.url));
const root=path.resolve(process.env.CAM_HEALTH_AUDIT_ROOT||process.argv[2]||path.join(repository,'..','cams-health-layout-audit'));
const pages=['boot-loading','boot-no-usable-data','home-saved-copy-source-error','home-invalid-schema-saved-copy','undo-dock-saved','undo-conflict-explanation',...['current','available','error','registration-error','unsupported','insecure','checking','applying','offline'].map(s=>'update-page-'+s)];
const modals=['sync-source-error',...['authorization-required','authorization-rejected','offline','conflict','service-error','readback-unconfirmed','in-progress'].map(s=>'food-save-'+s),'discard-confirmation',...['current','available','error','registration-error','unsupported','insecure','checking'].map(s=>'settings-update-'+s),'update-reload-confirmation','install-prompt-available','install-prompt-dismissed','rest-timer-finished','brief-incomplete-food','brief-empty-food'];
const descriptors=(ids,modes)=>ids.flatMap(id=>PROFILES.flatMap(p=>modes.map(mode=>({id,profile:p.id,mode}))));
const plans={system:[...descriptors(pages,['page']),...descriptors(modals,['popup','full'])],noscript:descriptors(['noscript-index.html','noscript-update.html'],['page'])};
for(const [domain,plan]of Object.entries(plans)){
 await fs.mkdir(path.join(root,domain+'-final'),{recursive:true});
 await fs.writeFile(path.join(root,domain+'-final','expected-states.json'),JSON.stringify(plan,null,2)+'\n');
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(plans).map(([domain,p])=>[domain,{states:new Set(p.map(s=>s.id)).size,combinations:p.length}]))));
