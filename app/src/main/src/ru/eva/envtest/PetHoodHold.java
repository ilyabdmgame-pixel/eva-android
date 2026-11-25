package ru.eva.envtest;

/** The pin is on the pale hood seam of the hand-painted fall frame. */
final class PetHoodHold {
    static final float PIN_X=150f/402f, PIN_Y=170f/540f;
    float swing, pinX, pinY, offsetX, offsetY;
    private float fromX,fromY,lastX,lastY;
    private long began,last;

    // Lift a small patch of hood fabric while keeping the face and silhouette intact.
    static final int COLS=24,ROWS=36;
    static void hoodMesh(float[] mesh,int x,int y,int width,int height){
        int i=0;
        for(int row=0;row<=ROWS;row++)for(int col=0;col<=COLS;col++){
            float sx=x+width*col/(float)COLS,sy=y+height*row/(float)ROWS;
            float dx=(sx-150)/23,dy=(sy-182)/39;
            float weight=(float)Math.exp(-.5f*(dx*dx+dy*dy));
            mesh[i++]=sx-(sx-150)*.18f*weight;
            mesh[i++]=sy-12*weight;
        }
    }

    void start(long now,float currentX,float currentY,float fingerX,float fingerY){
        began=last=now;
        fromX=currentX-fingerX;fromY=currentY-fingerY;
        pinX=currentX;pinY=currentY;
        lastX=fingerX;lastY=fingerY;
        swing=0;
    }
    boolean advance(long now,float fingerX,float fingerY,float angle,float height,boolean animate,boolean mirror){
        float dt=Math.max(0,(now-last)/1000f);
        float phase=Math.min(1,(now-began)/160f);
        float ease=phase*phase*(3-2*phase);
        pinX=fingerX+fromX*(1-ease);pinY=fingerY+fromY*(1-ease);
        double a=Math.toRadians(angle);
        float across=(float)((fingerX-lastX)*Math.cos(a)+(fingerY-lastY)*Math.sin(a));
        float rest=mirror?-2:2;
        // Finger travel drives a small lean. No momentum accumulates on reversal.
        if(animate&&dt>0){
            float velocity=across/(Math.max(1,height)*dt);
            float target=rest+Math.max(-3,Math.min(3,velocity));
            swing+=(target-swing)*(1-(float)Math.exp(-dt/.12f));
        }
        last=now;lastX=fingerX;lastY=fingerY;
        return phase<1||animate&&Math.abs(swing-rest)>.02f;
    }
    void offset(float width,float height,float angle,boolean mirror){
        double a=Math.toRadians(angle);
        float dx=(PIN_X-.5f)*width*(mirror?-1:1),dy=(PIN_Y-.5f)*height;
        offsetX=(float)(dx*Math.cos(a)-dy*Math.sin(a));
        offsetY=(float)(dx*Math.sin(a)+dy*Math.cos(a));
    }
}
