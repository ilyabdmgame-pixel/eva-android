package ru.eva.envtest;
import android.app.*;
import android.content.*;
import android.os.*;
import java.io.*;
import java.util.concurrent.*;

/** Foreground owner of Eva's private Linux runtime. No Activity owns the child. */
public final class CodexService extends Service {
 public final class LocalBinder extends Binder { public CodexService get(){return CodexService.this;} }
 public interface Listener {void changed();}
 public volatile String url="",status="Запускаю Еву…";
 private Listener listener;private java.lang.Process process;
 private PetOverlay pet;
 private static CodexService active;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 public void attach(Listener l){listener=l;l.changed();}
 public void detach(Listener l){if(listener==l)listener=null;}
 private void report(String text){handler.post(()->{status=text;if(listener!=null)listener.changed();});}
 @Override public void onCreate(){super.onCreate();try{
  active=this;
  startForeground(11,notification());
  try{pet=new PetOverlay(this);}catch(RuntimeException error){android.util.Log.w("EvaPet","Could not initialise overlay",error);}
  io.execute(this::startProcess);
 }catch(Exception e){report("Ошибка запуска: "+e.getMessage());}}
 private Notification notification(){
  NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  Notification.Builder builder;
  if(Build.VERSION.SDK_INT>=26){
   manager.createNotificationChannel(new NotificationChannel("eva_runtime","Среда Eva",NotificationManager.IMPORTANCE_LOW));
   builder=new Notification.Builder(this,"eva_runtime");
  }else builder=new Notification.Builder(this);
  boolean enabled=PetOverlay.enabled(this)&&android.provider.Settings.canDrawOverlays(this);
  int flags=PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE;
  builder.setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("Ева")
    .setContentText(enabled?"Ева может появляться поверх приложений":"Личная помощница работает")
    .setVisibility(Notification.VISIBILITY_PRIVATE).setOngoing(true).setOnlyAlertOnce(true)
    .setContentIntent(PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),flags));
  if(enabled){
   Intent open=new Intent(this,MainActivity.class).setAction(PetOverlay.OPEN_CHAT)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
   Intent stop=new Intent(this,CodexService.class).setAction(PetOverlay.STOP);
   builder.addAction(android.R.drawable.ic_menu_view,"Чат",PendingIntent.getActivity(this,1,open,flags))
      .addAction(android.R.drawable.ic_menu_close_clear_cancel,"Скрыть Еву",PendingIntent.getService(this,2,stop,flags));
  }
  return builder.build();
 }
 void openPetMap(){if(pet!=null)pet.requestSupportMap();}
 public static void desktopVisibilityChanged(){
  CodexService service=active;
  if(service!=null)service.handler.post(()->{if(active==service&&service.pet!=null)service.pet.sync();});
 }
 void refreshPet(boolean activityVisible,boolean composerVisible){
  if(pet!=null)pet.setPresentation(activityVisible&&!composerVisible,composerVisible);
  ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(11,notification());
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(intent!=null&&PetOverlay.STOP.equals(intent.getAction())){
   PetOverlay.setEnabled(this,false);
   refreshPet(false,false);
  }
  return START_NOT_STICKY;
 }
 @Override public void onConfigurationChanged(android.content.res.Configuration configuration){
  super.onConfigurationChanged(configuration);
  if(pet!=null)pet.configurationChanged();
 }
 @Override public IBinder onBind(Intent i){return new LocalBinder();}
 private void unpack(String asset,File root)throws Exception{
  File archive=new File(getCacheDir(),asset);
  try(InputStream in=getAssets().open(asset);OutputStream out=new FileOutputStream(archive)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}
  java.lang.Process p=new ProcessBuilder("/system/bin/tar","-xzf",archive.getAbsolutePath(),"-C",root.getAbsolutePath()).redirectErrorStream(true).start();
  ByteArrayOutputStream errors=new ByteArrayOutputStream();try(InputStream in=p.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)if(errors.size()<8192)errors.write(b,0,n);}
  if(p.waitFor()!=0)throw new IOException("Распаковка "+asset+" не завершена: "+errors.toString("UTF-8"));archive.delete();
 }
 private String[] runtimeVersions() throws IOException {
  try(BufferedReader reader=new BufferedReader(new InputStreamReader(getAssets().open("eva-runtime.version"),"US-ASCII"))){
   String base=reader.readLine(),app=reader.readLine();
   if(base==null||!base.matches("[0-9a-f]{64}")||app==null||!app.matches("[0-9a-f]{64}"))
    throw new IOException("Отсутствует версия среды Евы");
   return new String[]{base,app};
  }
 }
 private void installPack(File root,String asset,String markerName,String version,String status) throws Exception {
  File marker=new File(root,markerName);
  boolean current=false;
  if(marker.isFile()){
   try(BufferedReader in=new BufferedReader(new FileReader(marker))){current=version.equals(in.readLine());}
  }
  if(current)return;
  if(!root.isDirectory()&&!root.mkdirs())throw new IOException("Не удалось создать каталог среды");
  report(status);
  unpack(asset,root);
  File staged=new File(root,markerName+".tmp");
  try(Writer output=new FileWriter(staged)){output.write(version+"\n");}
  android.system.Os.rename(staged.getAbsolutePath(),marker.getAbsolutePath());
 }
 private void startProcess(){try{
  File dir=getFilesDir(),root=new File(dir,"rootfs"),lib=new File(getApplicationInfo().nativeLibraryDir);
  String[] versions=runtimeVersions();
  installPack(root,"rootfs.pack",".eva-base-version",versions[0],"Подготавливаю среду…");
  installPack(root,"eva-runtime.pack",".eva-runtime-version",versions[1],"Подготавливаю Еву…");
  for(String directory:new String[]{"dev","proc","sys","sdcard","tmp"})new File(root,directory).mkdirs();
  new File(root,"root/.codex/generated_images").mkdirs();
  String loaderAlias="p";
  for(String[] item:new String[][]{{"libtalloc.so.2","libtalloc.so"},{loaderAlias,"libproot-loader.so"}}){File alias=new File(dir,item[0]);try{android.system.Os.remove(alias.getAbsolutePath());}catch(Exception ignored){}android.system.Os.symlink(new File(lib,item[1]).getAbsolutePath(),alias.getAbsolutePath());}
  ProcessBuilder b=new ProcessBuilder(new File(lib,"libproot.so").getAbsolutePath(),"-0","-r",root.getAbsolutePath(),"-b","/dev:/dev","-b","/proc:/proc","-b","/sys:/sys","-b","/sdcard:/sdcard","-w","/root","/usr/bin/env","-i","HOME=/root","PATH=/usr/local/bin:/usr/bin:/bin","LANG=C.UTF-8","ADB_SERVER_SOCKET=tcp:localhost:5038","/usr/bin/node","/root/codex-mobile/server.js");
  b.environment().put("LD_LIBRARY_PATH",dir.getAbsolutePath()+":"+lib.getAbsolutePath());b.environment().put("PROOT_TMP_DIR",getCacheDir().getAbsolutePath());b.redirectError(new File(dir,"runtime-error.log"));process=b.start();
  try(BufferedReader in=new BufferedReader(new InputStreamReader(process.getInputStream(),"UTF-8"))){String line;while((line=in.readLine())!=null){if(line.equals("EVA_PET_WORK done")||line.equals("EVA_PET_WORK waiting")){boolean waiting=line.endsWith("waiting");handler.post(()->{if(pet!=null)pet.workNotice(waiting);});}else if(line.startsWith("EVA_READY ")){String ready=line.substring(10);if(ready.matches("^http://127\\.0\\.0\\.1:[0-9]{1,5}/#[0-9a-f]{48}$")){url=ready;report("Ева готова");}}}}
  url="";report("Среда остановлена. Откройте приложение заново.");
 }catch(Exception e){report("Ошибка запуска: "+e.getMessage());}}
 @Override public void onDestroy(){if(active==this)active=null;if(pet!=null)pet.destroy();if(process!=null)process.destroy();io.shutdownNow();handler.removeCallbacksAndMessages(null);super.onDestroy();}
}
