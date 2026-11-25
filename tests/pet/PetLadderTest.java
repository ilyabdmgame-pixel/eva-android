package ru.eva.envtest;

public final class PetLadderTest {
    static void check(boolean value,String message){if(!value)throw new AssertionError(message);}

    public static void main(String[] args){
        int checked=0;
        PetLadderMotion.Sample sample=new PetLadderMotion.Sample();
        float[] vertex=new float[2];
        for(int h:new int[]{150,300,410,540})for(int rises:new int[]{1,3,12,20})for(boolean left:new boolean[]{false,true}){
            int w=Math.round(h*402/540f),top=2*h,bottom=top+Math.round(h*(.81f+.079f*rises));
            PetLadderMotion motion=new PetLadderMotion(4*w,top,bottom,w,h,left);
            int duration=motion.duration(h/126f);
            motion.sample(sample,0,duration);
            check(sample.x==motion.startX&&Math.abs(sample.y-motion.startY)<=1,"Continuous entry");
            for(int time=0;time<duration;time+=9){
                motion.sample(sample,time,duration);
                if(!sample.mesh||time<PetLadderMotion.MOUNT_MS)continue;
                float[] deviations=new float[4];
                int[] xs={119,283,153,251},ys={116,116,530,530};
                for(int i=0;i<4;i++){
                    PetLadderMotion.vertex(xs[i],ys[i],sample,vertex,0);
                    float x=sample.x+w*(left?402-vertex[0]:vertex[0])/402;
                    float y=sample.y+h*vertex[1]/540;
                    check(x>=motion.center-motion.halfSpan&&x<=motion.center+motion.halfSpan,"Grip outside ladder");
                    check(y>=top-1.1f&&y<=bottom+1.1f,"Contact beyond end of ladder");
                    float rung=(bottom-y)/motion.pitch;
                    deviations[i]=Math.abs(rung-Math.round(rung))*motion.pitch;
                }
                check(Math.min(deviations[0],deviations[1])<1.1f,"Both hands released their rungs");
                check(Math.min(deviations[2],deviations[3])<1.1f,"Both soles lost their rungs");
                for(int yy=64;yy<529;yy+=17)for(int xx=100;xx<305;xx+=17){
                    PetLadderMotion.vertex(xx,yy,sample,vertex,0);
                    float x=vertex[0],y=vertex[1];
                    PetLadderMotion.vertex(xx+1,yy,sample,vertex,0);
                    float dx=vertex[0]-x,dy=vertex[1]-y;
                    PetLadderMotion.vertex(xx,yy+1,sample,vertex,0);
                    check(dx*(vertex[1]-y)-dy*(vertex[0]-x)>.1f,"Inverted rear mesh triangle");
                }
                checked++;
            }
            motion.sample(sample,duration,duration);
            check(!sample.mesh&&sample.key==23&&sample.x==motion.endX&&sample.y==motion.endY,"Continuous ledge handoff");
        }
        System.out.println("Rear ladder contacts, mesh orientation and mirrored transfers: "+checked+" samples");
    }
}
