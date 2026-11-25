package ru.eva.envtest;

public class PetHoodHoldTest {
    static void near(float a,float b,float tolerance){
        if(Math.abs(a-b)>tolerance)throw new AssertionError(a+" != "+b);
    }
    public static void main(String[] args){
        for(boolean mirror:new boolean[]{false,true})for(float angle:new float[]{0,90,180,270}){
            PetHoodHold p=new PetHoodHold();
            p.start(0,10,20,90,70);
            p.advance(0,90,70,angle,126,true,mirror);
            near(p.pinX,10,.01f);
            for(int t=16;t<=2000;t+=16)p.advance(t,90,70,angle,126,true,mirror);
            near(p.pinX,90,.001f);near(p.pinY,70,.001f);near(p.swing,mirror?-2:2,.05f);
            float rest=p.swing;
            p.advance(2016,90+(float)Math.cos(Math.toRadians(angle))*70,70+(float)Math.sin(Math.toRadians(angle))*70,angle,126,true,mirror);
            if(p.swing<=rest)throw new AssertionError("Body should trail hand in local gravity");
            p.offset(94,126,angle+p.swing,mirror);
            near((float)Math.hypot(p.offsetX,p.offsetY),(float)Math.hypot((PetHoodHold.PIN_X-.5f)*94,(PetHoodHold.PIN_Y-.5f)*126),.001f);
        }
        // The pickup easing must never swallow finger travel during its first frames.
        PetHoodHold stationary=new PetHoodHold(), moving=new PetHoodHold();
        stationary.start(0,25,30,100,100);
        moving.start(0,25,30,100,100);
        stationary.advance(16,100,100,0,126,true,false);
        moving.advance(16,150,72,0,126,true,false);
        near(moving.pinX-stationary.pinX,50,.001f);
        near(moving.pinY-stationary.pinY,-28,.001f);
        for(int step:new int[]{8,16,33}){
            PetHoodHold p=new PetHoodHold();
            p.start(0,0,0,0,0);
            int t=0;
            for(;t<1000;t+=step){
                float x=t<500?t*2:(1000-t)*2;
                float old=p.swing;
                p.advance(t,x,0,0,126,true,false);
                near(p.pinX,x,.001f);
                if(Math.abs(p.swing)>5.001f||Math.abs(old-p.swing)>55*step/1000f)
                    throw new AssertionError("Snap at direction change");
            }
            p.advance(t,0,0,0,126,true,false);
            for(int i=0;i<80;i++){
                float previous=p.swing-2;
                p.advance(t+=step,0,0,0,126,true,false);
                if((p.swing-2)*previous<0 || Math.abs(p.swing-2)>Math.abs(previous)+.001f)
                    throw new AssertionError("Oscillation after stop");
            }
        }
        // Model the canvas transform from sprite space back to screen space.
        for(boolean flipped:new boolean[]{false,true})for(int gravity:new int[]{0,90,180,270}){
            PetHoodHold p=new PetHoodHold();
            p.start(0,500,500,500,500);
            for(int i=1;i<180;i++){
                float fingerX=500+120*(float)Math.sin(i*.12);
                float fingerY=500+90*(float)Math.cos(i*.18);
                p.advance(i*8,fingerX,fingerY,gravity,410,true,flipped);
                float degrees=gravity+p.swing;
                p.offset(306,410,degrees,flipped);
                float dx=(PetHoodHold.PIN_X-.5f)*306*(flipped?-1:1);
                float dy=(PetHoodHold.PIN_Y-.5f)*410;
                double radians=Math.toRadians(degrees);
                near((float)(p.pinX-p.offsetX+dx*Math.cos(radians)-dy*Math.sin(radians)),fingerX,.001f);
                near((float)(p.pinY-p.offsetY+dx*Math.sin(radians)+dy*Math.cos(radians)),fingerY,.001f);
            }
        }
        int cols=PetHoodHold.COLS,rows=PetHoodHold.ROWS;
        float[] mesh=new float[(rows+1)*(cols+1)*2];
        PetHoodHold.hoodMesh(mesh,55,91,292,439);
        for(int r=0;r<=rows;r++)for(int c=0;c<=cols;c++){
            int i=(r*(cols+1)+c)*2;
            if(c>0&&mesh[i]<=mesh[i-2]||r>0&&mesh[i+1]<=mesh[i+1-2*(cols+1)])throw new AssertionError("Folded mesh");
        }
    }
}
