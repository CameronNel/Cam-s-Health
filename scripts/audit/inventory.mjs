import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {exerciseDemos} from '../../dist/exercise-catalogue.js';
const repository=fileURLToPath(new URL('../../',import.meta.url));
const root=path.resolve(process.env.CAM_HEALTH_AUDIT_ROOT||process.argv[2]||path.join(repository,'..','cams-health-layout-audit'));
const parse=(owner,source)=>source.trim().split('\n').map(line=>{const[id,surface,variants='']=line.split('|');return{id,owner,surface,variants:variants.split(',').filter(Boolean),evidence:'pending'};});
const core=parse('root',`
core-overview|One-page overview|rich,empty,all-three-widgets,unknown-values,long-names,javascript-disabled
core-loading|Initial loading screen|cold-load
core-load-error|No usable source|retry
core-cached|Saved-copy overview|offline,stale-indicator
core-schema-error|Rejected newer source|exact-entry-diagnostic,older-valid-copy
core-date|Date selector and day rail|today,past,future,week-boundary,previous,next
core-food-tracker|Food tracker|popup,full,rich,empty,incomplete
core-body-tracker|Body tracker|popup,full,rich,empty
core-workout-tracker|Workout tracker|popup,full,rich,empty,paused,awaiting-clearance,ready
core-history|Health history|rich,empty,body-food-workouts
core-settings|Tracker settings|metric,imperial,read-only,connected
core-targets|Targets and profile|pop,full,known,unset,imperial,training-status
core-quick-log|Quick log chooser|pop,full
core-food-detail|Recorded food detail|source-open,notes,long-title,unknown,review-flag
core-food-new|Manual food log|pop,full,blank,known,unknown,estimated,authorization
core-food-edit|Manual food correction|known,unknown,delete-action,metadata-preserved
core-food-repeat|Repeat prior food|review-portion,source-and-version-preserved
core-food-delete|Delete food confirmation|authorized,authorization
core-recipe-portion|Legacy recipe portion form|empty,live-preview,unknown,authorization
core-workout-custom|Manual custom session log|pop,full,blank,status,duration,actual-exercises
core-workout-prescribed|Manual prescribed session log|program-selection,partial,completed,actual-exercises
core-workout-rest|Manual rest-day log|recovery,completed
core-workout-detail|Recorded session detail|legacy,setLog,warmup,timed,variable-sets,long-notes
core-workout-edit|Recorded session correction|legacy,setLog,metadata-preservation,delete-action
core-workout-delete|Delete session confirmation|authorization,authorized
core-program-detail|Prescribed program detail|each-session,rest,exercise-notes-open,long-name
core-training-notice|Training status notice|paused,awaiting-clearance,ready
core-form-discard|Unsaved-change confirmation|keep-editing,discard,expanded-text
core-form-save-busy|Save in progress|disabled-controls,blocked-navigation
core-form-error|Inline save failure|invalid-input,missing-authorization,conflict,offline,ambiguous-readback,long-message
core-auth|GitHub connection form|blank,invalid-token,offline,busy,authorized,disconnect
core-inline-auth|Embedded authorization panel|closed,open,password-input,error
core-sync|Sync diagnostics|current,stale,error,read-only,connected
core-brief|Daily brief|rich,empty,incomplete,long-content
core-copy-fallback|Clipboard failure fallback|selected-text,long-content
core-export|Export actions|health-json,body-csv,download-only
core-print|Print action|print-dialog-handoff
core-timer|Rest timer|idle,active,paused,finished,preset,add-time
core-timer-dock|Rest timer dock|active,paused,small-screen
core-undo-dock|Undo affordance|verified-save,dismiss,alongside-timer
core-undo|Undo action|success,target-conflict,unrelated-newer-data-preserved
core-drafts|Unfinished entries|empty,list,long-titles,workout-resume
core-draft-recovery|Recoverable form draft banner|restore,remove,dynamic-rows,same-key,units
core-appearance|Look and feel|all-four-palettes,compact,detailed,clarity-0,clarity-100,all-widget-sizes,all-orders,haptics,reset
core-install|Installation instructions|Android-Chrome,iPhone-Safari,standalone,prompt-unavailable
core-update|In-app update flow|checking,current,available,failed,offline,review,activation
core-update-page|Standalone update recovery page|initial,checking,current,ready,failed,offline,insecure,no-service-worker,applying,noscript
core-focus-navigation|Keyboard and history navigation|tab,shift-tab,enter,escape,Android-back,modal-focus-restore
core-gesture|Tracker gestures|tap,hold,scroll-cancel,pinch-out,pinch-in,expand-control
core-reading-position|Restored reading position|scroll,metric,range,exercise,options
`);
const food=parse('food_expansion',`
food-hub|Food studio hub|rich,empty
food-lookup|Food finder|initial,results,empty,long-results
food-library|Food library|empty,full,long-names
food-favorite-portion|Favourite portion review|usual-amount,source
food-favorite-remove|Favourite removal confirmation|authorized,authorization
food-custom|Custom food form|new,edit,native-invalid,save-error
food-portion|Portion studio|grams,kilograms,ounces,millilitres,serving,household,catalogue-measure,invalid
food-portion-destination|Portion destination|logged-food,planned-meal,favourite,library-only
food-label|Nutrition label form|empty,file-selected,loading,recognised,raw-text,basis-unchecked,file-error,OCR-error
food-barcode|Product barcode lookup|empty,invalid,loading,found,not-found,network-error
food-barcode-camera|Barcode camera|permission-denied,unavailable,decoding,stopped
food-history|Food history search|full,query-results,empty,repeat
food-templates|Meal templates|empty,full
food-template-new|Create meal template|foods-selected,no-selection,error,long-list
food-template-bundle|Review meal template|normal,scaled,invalid-scale,log,plan
food-template-remove|Template removal confirmation|authorized,authorization
food-recipes|Recipe kitchen|empty,full,long-list
food-recipe-new|Recipe builder|blank,invalid,ingredient-search,dynamic-rows,unknown-nutrients,live-preview
food-recipe-edit|Create immutable recipe version|legacy-recipe,new-version,long-ingredients
food-recipe-versions|Recipe version history|empty,multiple-versions,old-version-portion
food-recipe-fork|Custom food from recipe nutrition|new-product-identity,version-preserved
food-plans|Planned meals|empty,full,incomplete-nutrition
food-plan-bundle|Review planned meal|log,move-date,scale,retain-plan
food-plan-remove|Plan removal confirmation|authorized,authorization
food-review|Nutrition review queue|empty,full,long-list
food-review-edit|Recorded nutrition review|confirmed,unconfirmed,unknown,source,notes
food-patterns|Weekly food patterns|empty,mixed,complete-days,target-ticks
food-settings|Food preferences|training-targets,rest-targets,default-day,preset-day,protein-focus
food-meal-groups|Organise meals|empty,full,all-four-meals,unassigned
food-complete|Food log completeness|empty,full,complete,incomplete
`);
const workouts=parse('workout_expansion',`
ws-hub|Workout studio|rich,clearance,resume
ws-replace|Replace local session confirmation|resume-existing,replace
ws-player|Live session player|every-prescribed-movement,unknown-custom,long-name,zero-sets,known-sets,unknown-performance
ws-effort|Optional effort controls|open,RIR-zero,RPE-known
ws-previous|Previous recorded performance|none,known,unknown,historical-range
ws-rest|Live rest panel|active,complete,skipped
ws-history|Performed set history|working,warmup,mixed,timed,unknown,undo
ws-superset|Superset player|alternate,round-rest
ws-substitute|Movement substitution chooser|unfiltered,filtered,empty,blocked-by-performed-sets
ws-config|Training setup|every-session,equipment,substitutions,groups,progression-rules,invalid-rule
ws-review|Review session|empty,rich,partial,completed,duration,notes,authorization,error
ws-discard|Local draft discard action|discard,resume
ws-resume|Session recovery|refresh,stored-entries,stored-sets,stored-units
ws-records|Personal records and milestones|empty,rich,rule-met,rule-unmet,unknown-values
ws-volume|Weekly training volume|empty,rich,working,warmup,unmapped,incomplete-volume
ws-set-edit|Individual performed set correction|long-logs,correction,conflict,recovered-draft
`);
const movements=parse('demo_expansion',`
demo-catalogue|Movement studio illustration|every-catalogue-entry,every-authored-variant,0-25-50-75-percent-pose
demo-camera|Demonstration camera|three-quarter,front,side,rear
demo-side|Unilateral demonstration|left,right,bilateral
demo-options|Camera and playback controls|folded,open,popup,fullscreen
demo-playback|Playback controls|play,pause,scrub,half-speed,real-time,1.5x,paths
demo-navigation|Movement selection|previous,next,first-disabled,last-disabled,long-list,remembered-position
demo-fallback|Illustration fallback|loading,module-error,no-WebGL,context-loss,unknown-custom,recovery-day
demo-lifecycle|Animation lifecycle|reduced-motion,hidden,offscreen,closed,reopened,pinch-preserves-viewer
`);
const body=JSON.parse(await readFile(new URL('./body-inventory.json',import.meta.url),'utf8')).cases.map(c=>({...c,owner:'body_expansion',surface:c.route,variants:c.states,evidence:'pending'}));
const spec={checkedDate:'2026-10-15',officialSource:'https://www.oppo.com/en/smartphones/series-find-x/find-x9-pro/specs/',secondaryOfficialSource:'https://www.oppo.com/in/smartphones/series-find-x/find-x9-pro/specs/',model:'OPPO Find X9 Pro CPH2791',nativePortrait:{width:1272,height:2772},heightWidthRatio:2772/1272,ratioToNine:2772/1272*9,diagonalInches:6.78,pixelsPerInch:450,maxRefreshHz:120,cssViewport:'not specified by manufacturer',browserDpr:'not specified by manufacturer',derivedPrimary:{width:424,height:924,dpr:3},note:'Derived emulation reproduces native pixel dimensions and aspect. It is not a measured ColorOS Chrome viewport; browser chrome, cutout/safe areas, display density and keyboard are separate constraints.'};
const catalogue=exerciseDemos.map(d=>({id:d.id,name:d.name,variants:d.variants?.map(v=>v.id)||[]}));
const families=[...core,...food,...body,...workouts,...movements].map(f=>({...f,required:f.id!=='core-history',...(f.id==='core-history'?{reachability:'retained direct-action renderer; no currently generated entry control'}:{})}));
const inventory={date:'2026-10-15',status:'inventory only; evidence reconciled separately after new audit captures',spec,counts:{core:core.length,food:food.length,body:body.length,workouts:workouts.length,movementFamilies:movements.length,catalogue:catalogue.length,catalogueVariants:catalogue.reduce((n,d)=>n+Math.max(1,d.variants.length),0),totalFamilies:families.length,requiredFamilies:families.filter(f=>f.required).length},families,catalogue};
await mkdir(root,{recursive:true});await writeFile(root+'/inventory.json',JSON.stringify(inventory,null,2)+'\n');console.log(JSON.stringify(inventory.counts));
