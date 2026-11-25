package ru.eva.envtest;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.List;

/** Short-lived, user-opened map. Touches are consumed only while this panel is visible. */
final class PetMapView extends FrameLayout {
    interface Actions{
        void close();
        boolean current();
        void save(List<PetHomeMap.Box> manual);
    }
    private final List<PetHomeMap.Box> detected,manual;
    private final Actions actions;
    private final TextView instruction;
    private final Button undo;
    private final Paint ink=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final int minimum;
    private float x0,y0,x1,y1;
    private boolean drawing;
    private final boolean editable;
    private final Runnable expire=()->{if(!drawing)close();};
    private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}

    PetMapView(Context context,List<PetHomeMap.Box> detected,List<PetHomeMap.Box> manual,
            boolean editable,int minimum,Actions actions){
        super(context);
        this.detected=detected;this.manual=manual;this.actions=actions;this.minimum=minimum;this.editable=editable;
        setWillNotDraw(false);
        LinearLayout bar=new LinearLayout(context);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable bg=new GradientDrawable();bg.setColor(0xf322303b);bg.setCornerRadius(dp(12));
        bar.setBackground(bg);bar.setPadding(dp(10),0,dp(2),0);
        instruction=new TextView(context);instruction.setTextColor(Color.WHITE);instruction.setTextSize(14);
        instruction.setText(editable?"Проведи пальцем вдоль края опоры":detected.isEmpty()?"Видимых опор нет":"Подсвечены видимые опоры");
        bar.addView(instruction,new LinearLayout.LayoutParams(0,-2,1));
        undo=button(context,"↶","Удалить последнюю добавленную опору");
        undo.setVisibility(manual.isEmpty()?GONE:VISIBLE);
        undo.setOnClickListener(v->{
            if(!actions.current()){close();return;}
            if(!manual.isEmpty()){manual.remove(manual.size()-1);actions.save(manual);}
            undo.setVisibility(manual.isEmpty()?GONE:VISIBLE);
            instruction.setText("Опора удалена");invalidate();extend();
        });
        bar.addView(undo);
        Button done=button(context,"×","Закрыть карту опор");
        done.setOnClickListener(v->close());bar.addView(done);
        LayoutParams barParams=new LayoutParams(-1,-2,Gravity.TOP);
        barParams.setMargins(dp(6),dp(4),dp(6),0);
        addView(bar,barParams);
        setContentDescription("Карта опор Евы");
    }
    private Button button(Context c,String text,String description){
        Button b=new Button(c, null,android.R.attr.borderlessButtonStyle);
        b.setText(text);b.setTextSize(22);b.setTextColor(Color.WHITE);b.setContentDescription(description);
        b.setPadding(0,0,0,0);b.setMinWidth(0);b.setMinimumWidth(0);
        b.setLayoutParams(new LinearLayout.LayoutParams(dp(48),dp(48)));return b;
    }
    @Override protected void onAttachedToWindow(){super.onAttachedToWindow();extend();}
    @Override protected void onDetachedFromWindow(){removeCallbacks(expire);super.onDetachedFromWindow();}
    private void extend(){removeCallbacks(expire);postDelayed(expire,editable?8500:4200);}
    private void close(){actions.close();}
    private void line(Canvas c,float l,float r,float y,int color){
        ink.setStrokeCap(Paint.Cap.ROUND);
        ink.setColor(0xcf10202b);ink.setStrokeWidth(dp(5));c.drawLine(l,y,r,y,ink);
        ink.setColor(color);ink.setStrokeWidth(dp(2));c.drawLine(l,y,r,y,ink);
        c.drawCircle(l,y,dp(3),ink);c.drawCircle(r,y,dp(3),ink);
    }
    @Override protected void onDraw(Canvas c){
        super.onDraw(c);
        for(PetHomeMap.Box b:detected)line(c,b.l,b.r,b.t,0xff72f0d2);
        for(PetHomeMap.Box b:manual)line(c,b.l,b.r,b.t,0xffffcf83);
        if(drawing)line(c,Math.min(x0,x1),Math.max(x0,x1),(y0+y1)/2,0xffffcf83);
    }
    @Override public boolean onTouchEvent(MotionEvent e){
        switch(e.getActionMasked()){
            case MotionEvent.ACTION_DOWN:
                if(!editable){close();return true;}
                removeCallbacks(expire);drawing=true;x0=x1=e.getX();y0=y1=e.getY();invalidate();return true;
            case MotionEvent.ACTION_MOVE:
                if(drawing){x1=e.getX();y1=e.getY();invalidate();}return true;
            case MotionEvent.ACTION_POINTER_DOWN:
            case MotionEvent.ACTION_CANCEL:
                drawing=false;invalidate();extend();return true;
            case MotionEvent.ACTION_UP:
                if(!drawing)return true;
                drawing=false;
                if(!actions.current()){close();return true;}
                PetHomeMap.Box edge=PetLearnedEdges.stroke(x0,y0,e.getX(),e.getY(),getWidth(),getHeight(),minimum,dp(4));
                if(edge==null)instruction.setText("Проведи горизонтальную линию подлиннее");
                else if(PetLearnedEdges.duplicate(manual,edge,dp(4))||PetLearnedEdges.duplicate(detected,edge,dp(4)))
                    instruction.setText("Эта опора уже отмечена");
                else if(manual.size()>=32)instruction.setText("Уже 32 опоры. Удали последнюю");
                else{
                    manual.add(edge);actions.save(manual);undo.setVisibility(VISIBLE);
                    instruction.setText("Опора сохранена на этой странице");
                }
                invalidate();extend();return true;
            default:return true;
        }
    }
}
