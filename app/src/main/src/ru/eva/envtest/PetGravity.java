package ru.eva.envtest;

final class PetGravity {
    static final int DOWN=0,LEFT=1,UP=2,RIGHT=3;
    private static final float EARTH=9.81f;
    private float x,y,z;
    private boolean available;
    private int candidate=DOWN,direction=DOWN;
    private long since;

    static int bodyAngle(int direction){
        return direction==RIGHT?-90:direction*90;
    }

    static boolean sideways(int direction){return (direction&1)!=0;}

    static int centeredStart(int start,int oldSize,int newSize){
        return start+Math.round((oldSize-newSize)*.5f);
    }

    void read(float x,float y,float z,boolean accelerometer){
        if(Float.isNaN(x+y+z)||Float.isInfinite(x+y+z))return;
        float gain=available&&accelerometer?.18f:1f;
        this.x+=(x-this.x)*gain;
        this.y+=(y-this.y)*gain;
        this.z+=(z-this.z)*gain;
        available=true;
    }

    float horizontal(int rotation){
        return rotation==0?-x:rotation==1?y:rotation==2?x:-y;
    }

    float vertical(int rotation){
        return rotation==0?y:rotation==1?x:rotation==2?-y:-x;
    }

    float strength(int rotation){
        if(!available||Math.hypot(x,y)<4)return 1f;
        return PetMotion.clamp(vertical(rotation)/EARTH,.45f,1.15f);
    }

    float screenStrength(int rotation){
        return PetMotion.clamp((float)Math.hypot(horizontal(rotation),vertical(rotation))/EARTH,.45f,1.15f);
    }

    PetMotion.Position destination(int direction,int rotation,int x,int y,int maxX,int maxY){
        float gx=horizontal(rotation),gy=vertical(rotation);
        if(direction==UP){
            int nextX=Math.round(x+gx*y/Math.max(1,Math.abs(gy)));
            return new PetMotion.Position(Math.max(0,Math.min(maxX,nextX)),0);
        }
        int nextX=direction==LEFT?0:maxX;
        int nextY=Math.round(y+gy*Math.abs(nextX-x)/Math.max(1,Math.abs(gx)));
        return new PetMotion.Position(nextX,Math.max(0,Math.min(maxY,nextY)));
    }

    int direction(int rotation,long now){
        float h=horizontal(rotation),v=vertical(rotation);
        float horizontal=Math.abs(h),vertical=Math.abs(v);
        int next=DOWN;
        if(available&&Math.hypot(h,v)>=5&&Math.abs(z)<8){
            if(horizontal>vertical*1.25f)next=h<0?LEFT:RIGHT;
            else if(v<0&&vertical>horizontal*1.25f)next=UP;
            else if(vertical<=horizontal*1.25f)next=direction;
        }
        if(next!=candidate){candidate=next;since=now;}
        if(now-since>=440)direction=candidate;
        return direction;
    }

    void resetDirection(){candidate=direction=DOWN;since=0;}
}
