package ru.eva.envtest;

final class PetPlacement {
    static final float SEAT_CONTACT=374f/540f;
    static final float POINT_CONTACT=170f/540f;
    final int x,y;
    final boolean left,seated;
    final String source;

    private PetPlacement(int x,int y,boolean left,boolean seated,String source) {
        this.x=x;
        this.y=y;
        this.left=left;
        this.seated=seated;
        this.source=source;
    }

    static PetPlacement onSurface(String source,boolean seated,int left,int top,int right,int bottom,
            int windowW,int windowH,int maxX,int maxY,int currentX) {
        if(right-left<windowW*2||bottom<=top||left<0||right>maxX+windowW||bottom>maxY+windowH+4)return null;
        boolean leftSide=currentX<=maxX/2;
        float width=right-left;
        float center=left+(leftSide?.24f:.76f)*width;
        int x=Math.round(center-windowW/2f);
        int y;
        if(seated) y=top-Math.round(windowH*SEAT_CONTACT);
        else {
            int contact=Math.round(windowH*POINT_CONTACT);
            int pointer=top+Math.round((bottom-top)*.8f);
            y=Math.max(0,pointer-contact);
            if(y+contact<top||y+contact>=bottom)return null;
        }
        if(x<0||x>maxX||y<0||y>maxY)return null;
        return new PetPlacement(x,y,!leftSide,seated,source);
    }

    boolean sameSurface(PetPlacement other,int tolerance) {
        return other!=null&&source.equals(other.source)&&seated==other.seated&&
            Math.abs(x-other.x)<=tolerance&&Math.abs(y-other.y)<=tolerance;
    }
}
