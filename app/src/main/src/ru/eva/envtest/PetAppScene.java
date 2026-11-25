package ru.eva.envtest;

import android.content.Context;
import android.graphics.Rect;
import android.media.AudioManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Transient screen geometry only. User text and descriptions are not retained. */
final class PetAppScene {
    final String app;
    final boolean home;
    boolean editing, video;
    final Rect editor=new Rect(), keyboard=new Rect(), player=new Rect();
    final List<Rect> buttons=new ArrayList<>();
    private boolean playerPlaying,explicitPlayer;
    private PetAppScene(String app,boolean home){this.app=app;this.home=home;}

    static PetAppScene read(EvaAccessibility service,String launcher){
        if(service==null)return null;
        List<AccessibilityWindowInfo> windows=service.getWindows();
        if(windows==null)return null;
        Rect ime=new Rect();
        AccessibilityWindowInfo active=null;
        try{
            for(AccessibilityWindowInfo w:windows){
                if(w.getType()==AccessibilityWindowInfo.TYPE_SYSTEM&&w.isFocused())return null;
                if(w.getType()==AccessibilityWindowInfo.TYPE_INPUT_METHOD)w.getBoundsInScreen(ime);
                if(w.getType()!=AccessibilityWindowInfo.TYPE_APPLICATION)continue;
                if(w.isFocused()||(active==null&&w.isActive()))active=w;
            }
            if(active==null)return null;
            AccessibilityNodeInfo root=active.getRoot();
            if(root==null)return null;
            try{
                if(root.getPackageName()==null)return null;
                String app=root.getPackageName().toString();
                if(app.equals(service.getPackageName()))return null;
                PetAppScene scene=new PetAppScene(app,app.equals(launcher)||app.equals("com.hihonor.android.launcher"));
                if(scene.home)return scene;
                Rect host=new Rect();active.getBoundsInScreen(host);
                scene.keyboard.set(ime);
                scene.editing=!ime.isEmpty();
                scene.inspect(root,host,service.getResources().getDisplayMetrics().density);
                AudioManager audio=(AudioManager)service.getSystemService(Context.AUDIO_SERVICE);
                boolean videoApp=app.equals("com.google.android.youtube")||app.equals("org.videolan.vlc")||
                    app.startsWith("com.netflix.")||app.equals("com.google.android.apps.youtube.kids");
                scene.video=PetAppPolicy.watching(!scene.player.isEmpty(),scene.playerPlaying,
                    audio!=null&&audio.isMusicActive(),!scene.explicitPlayer,videoApp);
                return scene;
            }finally{root.recycle();}
        }finally{for(AccessibilityWindowInfo w:windows)w.recycle();}
    }

    private void inspect(AccessibilityNodeInfo root,Rect host,float density){
        ArrayDeque<AccessibilityNodeInfo> queue=new ArrayDeque<>();
        queue.add(AccessibilityNodeInfo.obtain(root));
        int budget=88;
        try{
            while(!queue.isEmpty()&&budget-->0){
                AccessibilityNodeInfo node=queue.removeFirst();
                try{
                    if(!node.isVisibleToUser())continue;
                    Rect box=new Rect();node.getBoundsInScreen(box);
                    if(!box.intersect(host))continue;
                    if(node.isEditable()||node.isPassword()){
                        if(node.isFocused())editor.set(box);
                        continue;
                    }
                    String id=node.getViewIdResourceName();
                    id=id==null?"":id.substring(id.lastIndexOf('/')+1).toLowerCase(Locale.ROOT);
                    String cls=node.getClassName()==null?"":node.getClassName().toString();
                    boolean videoRole=cls.endsWith("VideoView")||cls.endsWith("PlayerView")||
                        id.equals("movie_player")||id.equals("player_view")||id.equals("exo_content_frame")||
                        id.equals("video_surface")||id.equals("player_surface")||id.equals("video_player");
                    boolean largeSurface=(cls.endsWith("SurfaceView")||cls.endsWith("TextureView"))&&
                        box.width()>=host.width()*.75&&box.height()>=host.height()*.50;
                    if(videoRole&&box.width()>=host.width()*.42&&box.height()>=72*density)explicitPlayer=true;
                    if((videoRole||largeSurface)&&box.width()>=host.width()*.42&&box.height()>=72*density)
                        if((long)box.width()*box.height()>(long)player.width()*player.height())player.set(box);
                    if(id.equals("exo_pause")||id.equals("pause_button")||id.equals("pause"))playerPlaying=true;
                    if(id.equals("play_pause_button")||id.equals("exo_play_pause")||id.equals("play_pause")){
                        CharSequence hint=node.getContentDescription();
                        if(hint!=null&&("pause".equalsIgnoreCase(hint.toString())||
                            "пауза".equalsIgnoreCase(hint.toString())||
                            "приостановить".equalsIgnoreCase(hint.toString())))playerPlaying=true;
                    }
                    if(node.isClickable()&&node.isEnabled()&&buttons.size()<22&&
                        box.height()>=18*density&&box.height()<=100*density&&box.width()>=18*density&&
                        box.width()<host.width()*.8)buttons.add(box);
                    int children=Math.min(node.getChildCount(),Math.max(0,budget-queue.size()));
                    for(int i=0;i<children;i++){
                        AccessibilityNodeInfo child=node.getChild(i);if(child!=null)queue.addLast(child);
                    }
                }finally{node.recycle();}
            }
        }finally{while(!queue.isEmpty())queue.removeFirst().recycle();}
    }

    /** Prefer a clear corner near the bottom, keeping the actual composer and keyboard usable. */
    int[] parking(int ox,int oy,int width,int height,int w,int h,boolean watch,int currentX){
        int bestScore=Integer.MAX_VALUE,bestX=0,bestY=0;
        if(watch||!keyboard.isEmpty()){
            for(int cx:new int[]{0,Math.max(0,width-w)}){
                int left=ox+cx+w/5,right=ox+cx+w-w/5;
                boolean aboveIme=!keyboard.isEmpty()&&left<keyboard.right&&right>keyboard.left&&keyboard.bottom>oy;
                int cy=PetAppPolicy.floorY(height,h,aboveIme,keyboard.top-oy);
                if(!keyboard.isEmpty()&&!editor.isEmpty()&&left<editor.right&&right>editor.left)
                    cy=PetAppPolicy.clearEditorY(cy,h,editor.top-oy,editor.bottom-oy);
                Rect visible=new Rect(left,oy+cy,right,oy+cy+h);
                int overlaps=0;
                for(Rect button:buttons)if(Rect.intersects(visible,button))overlaps++;
                int score=PetAppPolicy.cost(Math.max(0,height-h),cy,cx,currentX,height,overlaps,
                    Rect.intersects(visible,editor),false,false);
                if(score<bestScore){bestScore=score;bestX=cx;bestY=cy;}
            }
            return new int[]{bestX,bestY};
        }
        List<Rect> ledges=new ArrayList<>(buttons);

        if(!editor.isEmpty())ledges.add(editor);
        int low=Math.max(0,height-h);
        for(int cx:new int[]{0,Math.max(0,width-w)}){
            int foot=ox+cx+w/2;
            int[] rows=new int[1+ledges.size()];
            rows[0]=low;
            int count=1;
            for(Rect ledge:ledges){
                if(foot<ledge.left||foot>=ledge.right)continue;
                int cy=ledge.top-oy-h;
                if(cy>=0&&cy<low)rows[count++]=cy;
            }
            for(int row=0;row<count;row++){
                int cy=rows[row];
                Rect area=new Rect(ox+cx,oy+cy,ox+cx+w,oy+cy+h);
                int overlaps=0;
                for(Rect button:buttons)if(Rect.intersects(area,button))overlaps++;
                int score=PetAppPolicy.cost(low,cy,cx,currentX,height,overlaps,Rect.intersects(area,editor),
                    Rect.intersects(area,keyboard),watch&&!player.isEmpty()&&area.centerY()<player.centerY());
                if(score<bestScore){bestScore=score;bestX=cx;bestY=cy;}
            }
        }
        return new int[]{bestX,bestY};
    }

    Rect nearbyButton(int worldX,int worldY,int w,int h){
        Rect choice=null;int distance=Integer.MAX_VALUE;
        for(Rect b:buttons){
            int dx=Math.abs(b.centerX()-worldX),dy=Math.abs(b.centerY()-worldY);
            if(dy>h||dx>w*3)continue;
            int d=dx+dy;if(d<distance){choice=b;distance=d;}
        }
        return choice;
    }
}
